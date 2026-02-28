import type { Token, TokenKind } from "./token.js"
import type {
  DocumentNode,
  ElementNode,
  Decoration,
  JsonValue,
  Placeholder,
  GroupValue,
  AttributeValue,
} from "./ast.js"
import type { Options, NormalizedOptions, TagDelimiterPair } from "./types.js"
import { normalizeOptions } from "./types.js"
import { decodeJsonString, encodeJsonValue } from "./utils.js"
import {
  NAME_PATTERN,
  NAME_FORMAT,
} from "./naming.js"

// --- tokenize 内部ヘルパー ---

/**
 * 文字が空白文字（スペース・タブ・改行・復帰）かどうかを判定する
 * @param ch - 判定対象の1文字
 * @returns 空白文字であればtrue
 */
function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r"
}

/**
 * 文字が名前の先頭文字として有効かどうかを判定する（英字のみ）
 * charCodeAt による高速パス実装（tokenizer ホットループ用）
 * @param ch - 判定対象の1文字
 * @returns 先頭文字として有効であればtrue
 */
function isNameFirstChar(ch: string): boolean {
  const c = ch.charCodeAt(0)
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) // A-Z, a-z
}

/**
 * 文字が識別子に使用可能な文字（英数字・アンダースコア・ハイフン）かどうかを判定する
 * charCodeAt による高速パス実装（tokenizer ホットループ用）
 * @param ch - 判定対象の1文字
 * @returns 識別子文字であればtrue
 */
function isIdentChar(ch: string): boolean {
  const c = ch.charCodeAt(0)
  return (
    (c >= 65 && c <= 90) || // A-Z
    (c >= 97 && c <= 122) || // a-z
    (c >= 48 && c <= 57) || // 0-9
    c === 95 || // _
    c === 45 // -
  )
}

/**
 * 文字列が名前として有効かどうかを判定する（[a-zA-Z][a-zA-Z0-9_-]*）
 * @param name - 判定対象の文字列
 * @returns 有効な名前であればtrue
 */
function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name)
}

/**
 * トークナイズ時のエラーを送出する
 * @param message - エラーメッセージ
 * @param position - エラーが発生した入力文字列中の位置
 * @throws {Error} 常にエラーをスローする
 */
function tokenError(message: string, position: number): never {
  throw new Error(`${message}, position=${position}`)
}

/**
 * 指定位置がJSON値の境界（空白・閉じデリミタ・/+閉じデリミタ・入力末尾）かどうかを判定する
 * @param input - 入力文字列全体
 * @param end - 判定対象の位置
 * @param closing - 現在のタグの閉じデリミタ文字
 * @param extraBoundaries - 追加の境界文字（グループ値内での "," や ")" など）
 * @returns 境界であればtrue
 */
function isJsonBoundary(
  input: string,
  end: number,
  closing: string,
  extraBoundaries?: string[],
): boolean {
  const len = input.length
  if (end >= len) return true
  const ch = input[end]
  if (isWhitespace(ch) || ch === closing) return true
  if (ch === "/" && end + 1 < len && input[end + 1] === closing) return true
  if (extraBoundaries) {
    for (const boundary of extraBoundaries) {
      if (ch === boundary) return true
    }
  }
  return false
}

/**
 * 文字がJSON値の開始文字として有効かどうかを判定する
 * @param ch - 判定対象の1文字
 * @returns JSON値の開始文字であればtrue
 */
function canStartJsonValue(ch: string): boolean {
  return (
    ch === '"' ||
    ch === "{" ||
    ch === "[" ||
    ch === "-" ||
    (ch >= "0" && ch <= "9") ||
    ch === "t" ||
    ch === "f" ||
    ch === "n"
  )
}

/**
 * エラーメッセージ用に、不正なリテラルのプレビュー文字列を取得する
 * @param input - 入力文字列全体
 * @param pos - プレビュー開始位置
 * @param closing - 現在のタグの閉じデリミタ文字
 * @returns プレビュー文字列。入力末尾の場合は`"<eof>"`
 */
function readLiteralPreview(input: string, pos: number, closing: string): string {
  const len = input.length
  let i = pos
  while (i < len) {
    const ch = input[i]
    if (isWhitespace(ch) || ch === closing || ch === "/" || ch === "=") break
    i++
  }
  if (i === pos) return "<eof>"
  return input.slice(pos, i)
}

/**
 * JSON文字列リテラルの終端位置をスキャンする。エスケープされた引用符を考慮する
 * @param input - 入力文字列全体
 * @param pos - 開始引用符の位置
 * @returns 閉じ引用符の次の位置
 * @throws {Error} 文字列が閉じられない場合
 */
function scanJsonString(input: string, pos: number): number {
  const len = input.length
  pos++ // 開始 " をスキップ
  while (pos < len) {
    const ch = input[pos]
    if (ch === "\\") {
      pos += 2 // エスケープシーケンスをスキップ
      continue
    }
    if (ch === '"') {
      return pos + 1 // 閉じ " の次の位置
    }
    pos++
  }
  tokenError("unterminated json string: expected=<closing quote>, actual=<eof>", pos)
}

/**
 * JSON のオブジェクトまたは配列の終端位置をブラケットカウンティングでスキャンする。
 * 文字列リテラル内の括弧はスキップする
 * @param input - 入力文字列全体
 * @param pos - 開始括弧（{ または [）の位置
 * @returns 閉じ括弧の次の位置
 * @throws {Error} 括弧が閉じられない場合
 */
function scanJsonBracket(input: string, pos: number): number {
  const len = input.length
  const openChar = input[pos]
  const closeChar = openChar === "{" ? "}" : "]"
  let depth = 1
  pos++ // 開始括弧をスキップ
  while (pos < len && depth > 0) {
    const ch = input[pos]
    if (ch === '"') {
      pos = scanJsonString(input, pos)
      continue
    }
    if (ch === openChar) {
      depth++
    } else if (ch === closeChar) {
      depth--
    }
    pos++
  }
  if (depth > 0) {
    tokenError(`unterminated json bracket: expected=<${closeChar}>, actual=<eof>`, pos)
  }
  return pos // 閉じ括弧の次の位置
}

/**
 * 入力文字列からJSON値を読み取る。先頭文字に応じて終端を線形スキャンで特定し、JSON.parse を最大1回呼ぶ
 * @param input - 入力文字列全体
 * @param pos - 読み取り開始位置
 * @param closing - 現在のタグの閉じデリミタ文字
 * @param extraBoundaries - 追加の境界文字（グループ値内での "," や ")" など）
 * @returns JSON値の生文字列と読み取り後の位置のタプル
 * @throws {Error} JSON値が見つからない、または不正な場合
 */
function readJsonValue(
  input: string,
  pos: number,
  closing: string,
  extraBoundaries?: string[],
): [value: string, newPos: number] {
  const len = input.length

  // 属性値の前にある空白を読み飛ばす
  while (pos < len && isWhitespace(input[pos])) pos++

  if (pos >= len) {
    tokenError("missing attribute value: expected=<json-value>, actual=<eof>", pos)
  }

  if (isJsonBoundary(input, pos, closing, extraBoundaries)) {
    const actual = input[pos] === "/" ? "/" + closing : input[pos]
    tokenError(`missing attribute value: expected=<json-value>, actual=<${actual}>`, pos)
  }

  if (!canStartJsonValue(input[pos])) {
    tokenError(`invalid json value start: expected=<json-start>, actual=<${input[pos]}>`, pos)
  }

  const startChar = input[pos]
  let end: number

  if (startChar === '"') {
    // 文字列リテラル: 対応する閉じ引用符を線形スキャン
    end = scanJsonString(input, pos)
  } else if (startChar === "{" || startChar === "[") {
    // オブジェクト/配列: ブラケットカウンティングで終端を特定
    end = scanJsonBracket(input, pos)
  } else {
    // 数値・真偽値・null: 最初の境界位置まで読み進める
    end = pos + 1
    while (end < len && !isJsonBoundary(input, end, closing, extraBoundaries)) {
      end++
    }
  }

  // 構造化値（文字列・オブジェクト・配列）の直後が境界でなければエラー
  if (!isJsonBoundary(input, end, closing, extraBoundaries)) {
    tokenError(
      `invalid json attribute value: expected=<boundary>, actual=<${input[end]}>`,
      end,
    )
  }

  const candidate = input.slice(pos, end)
  const result = decodeJsonString(candidate)
  if (result.success) {
    return [candidate, end]
  }

  const lastDecodeIssue = result.error.issues[0]?.message ?? "invalid json"
  tokenError(
    `invalid json attribute value: expected=<valid-json>, actual=<${readLiteralPreview(input, pos, closing)}>, detail=<${lastDecodeIssue}>`,
    pos,
  )
}

/**
 * 入力文字列から placeholder を読み取る。$[a-zA-Z][a-zA-Z0-9_-]* の形式
 * @param input - 入力文字列全体
 * @param pos - 読み取り開始位置（$ の位置）
 * @returns ドル記号を含む placeholder 文字列と読み取り後の位置のタプル
 * @throws {Error} $ の後が英字でない、または $ のみの場合
 */
function readPlaceholder(input: string, pos: number): [value: string, newPos: number] {
  const len = input.length
  // pos は $ の位置
  const start = pos
  pos++ // $ をスキップ

  if (pos >= len || !isNameFirstChar(input[pos])) {
    const actual = pos < len ? input[pos] : "<eof>"
    tokenError(`invalid placeholder: expected=<$${NAME_FORMAT}>, actual=<$${actual}>`, start)
  }

  while (pos < len && isIdentChar(input[pos])) pos++

  return [input.slice(start, pos), pos]
}

// --- トークナイザ内部の型定義 ---

/**
 * 開始デリミタ文字から対応するペア情報を引くためのルックアップエントリ
 */
interface DelimiterLookupEntry {
  pairIndex: number
  closing: string
}

/**
 * デリミタペア配列からルックアップマップを構築する
 * @param tags - デリミタペアの配列
 * @returns 開始デリミタ文字をキーとするルックアップマップ
 */
function buildOpeningLookup(tags: TagDelimiterPair[]): Map<string, DelimiterLookupEntry> {
  const map = new Map<string, DelimiterLookupEntry>()
  for (let i = 0; i < tags.length; i++) {
    map.set(tags[i].opening, { pairIndex: i, closing: tags[i].closing })
  }
  return map
}

/**
 * 全デリミタ文字（opening + closing）の集合を構築する
 * @param tags - デリミタペアの配列
 * @returns デリミタ文字の集合
 */
function buildAllDelimiterChars(tags: TagDelimiterPair[]): Set<string> {
  const set = new Set<string>()
  for (const pair of tags) {
    set.add(pair.opening)
    set.add(pair.closing)
  }
  return set
}

// --- tokenize 本体 ---

/**
 * 入力文字列をトークン列に分割する
 * @param input - onlytagマークアップの入力文字列
 * @param options - 正規化済みの機能オプション
 * @returns トークンの配列。末尾にEOFトークンを含む
 * @throws {Error} 不正な文字やトークンが含まれる場合
 */
function tokenize(input: string, options: NormalizedOptions): Token[] {
  const tokens: Token[] = []
  const len = input.length
  let pos = 0
  let lastKind: TokenKind | null = null

  // 状態マシン用
  let insideTag = false
  let currentClosing: string | null = null
  let currentPairIndex: number | null = null
  let insideGroup = false

  // ルックアップ構造
  const openingLookup = buildOpeningLookup(options.tags)
  const allDelimiterChars = buildAllDelimiterChars(options.tags)

  function emit(kind: TokenKind, value: string, position: number, pairIndex?: number) {
    const token: Token = { kind, value, position }
    if (pairIndex !== undefined) {
      token.pairIndex = pairIndex
    }
    tokens.push(token)
    lastKind = kind
  }

  while (true) {
    // 空白を読み飛ばす
    while (pos < len && isWhitespace(input[pos])) pos++

    // EQUALS の直後は JSON 値、placeholder、またはグループ値として読む
    if (lastKind === "EQUALS") {
      // 属性値前の空白を読み飛ばす
      while (pos < len && isWhitespace(input[pos])) pos++

      const start = pos
      if (pos < len && input[pos] === "$") {
        if (!options.allowPlaceholders) {
          tokenError(`placeholders are not allowed: found placeholder at position`, start)
        }
        const [value, newPos] = readPlaceholder(input, pos)
        emit("PLACEHOLDER", value, start)
        pos = newPos
      } else if (pos < len && input[pos] === "(") {
        if (!options.allowGroup) {
          tokenError(`groups are not allowed: found group at position`, start)
        }
        emit("LPAREN", "(", start)
        pos++
        insideGroup = true
      } else {
        const [value, newPos] = readJsonValue(input, pos, currentClosing!)
        emit("JSON_VALUE", value, start)
        pos = newPos
      }
      continue
    }

    // グループ内: LPAREN または COMMA の直後は JSON 値または placeholder を読む
    if (insideGroup && (lastKind === "LPAREN" || lastKind === "COMMA")) {
      while (pos < len && isWhitespace(input[pos])) pos++

      // 空グループまたは末尾の RPAREN チェック
      if (pos < len && input[pos] === ")") {
        if (lastKind === "LPAREN") {
          emit("RPAREN", ")", pos)
          pos++
          insideGroup = false
          continue
        }
        // COMMA の直後に ) が来るのは不正（値が欠落）
        tokenError(`missing group value: expected=<json-value|placeholder>, actual=<)>`, pos)
      }

      const start = pos
      if (pos < len && input[pos] === "$") {
        if (!options.allowPlaceholders) {
          tokenError(`placeholders are not allowed: found placeholder at position`, start)
        }
        const [value, newPos] = readPlaceholder(input, pos)
        emit("PLACEHOLDER", value, start)
        pos = newPos
      } else {
        const [value, newPos] = readJsonValue(input, pos, currentClosing!, [",", ")"])
        emit("JSON_VALUE", value, start)
        pos = newPos
      }
      continue
    }

    // グループ内: 値の後は "," か ")" を期待する
    if (insideGroup && (lastKind === "JSON_VALUE" || lastKind === "PLACEHOLDER")) {
      while (pos < len && isWhitespace(input[pos])) pos++

      if (pos >= len) {
        tokenError(`unclosed group value: expected=<,|)>, actual=<eof>`, pos)
      }

      const ch = input[pos]
      if (ch === ",") {
        emit("COMMA", ",", pos)
        pos++
        continue
      }
      if (ch === ")") {
        emit("RPAREN", ")", pos)
        pos++
        insideGroup = false
        continue
      }
      tokenError(`unexpected character in group value: expected=<,|)>, actual=<${ch}>`, pos)
    }

    if (pos >= len) break

    const start = pos
    const ch = input[pos]

    if (insideTag) {
      // --- タグ内部 ---
      const closing = currentClosing!

      if (ch === closing) {
        // 閉じデリミタ → GT
        emit("GT", closing, start, currentPairIndex!)
        pos += 1
        insideTag = false
        currentClosing = null
        currentPairIndex = null
        continue
      }

      if (ch === "/" && pos + 1 < len && input[pos + 1] === closing) {
        // /closing → SLASH_GT
        emit("SLASH_GT", "/" + closing, start, currentPairIndex!)
        pos += 2
        insideTag = false
        currentClosing = null
        currentPairIndex = null
        continue
      }

      if (ch === "=") {
        if (!options.allowAttributes) {
          tokenError(`attributes are not allowed: found attribute at position`, start)
        }
        emit("EQUALS", "=", start)
        pos += 1
        continue
      }

      if (ch === ".") {
        pos += 1
        if (pos < len && isNameFirstChar(input[pos])) {
          if (!options.allowDecorations) {
            tokenError(`decorations are not allowed: found decoration at position`, start)
          }
          const identStart = pos
          while (pos < len && isIdentChar(input[pos])) pos++
          emit("DOT_IDENT", "." + input.slice(identStart, pos), start)
        } else {
          const actual = pos < len ? `.${input[pos]}` : ".<eof>"
          tokenError(
            `invalid decoration token: expected=<.${NAME_FORMAT}>, actual=<${actual}>`,
            start,
          )
        }
        continue
      }

      if (ch === "/") {
        // "/" だがその次が closing ではない
        const next = pos + 1 < len ? input[pos + 1] : "<eof>"
        tokenError(`invalid slash token: expected=</${closing}>, actual=</${next}>`, pos)
      }

      if (isNameFirstChar(ch)) {
        while (pos < len && isIdentChar(input[pos])) pos++
        emit("IDENT", input.slice(start, pos), start)
        continue
      } else if (isIdentChar(ch)) {
        // 先頭が英字でない識別子文字（数字・_・-）はエラー
        tokenError(
          `invalid identifier start: expected=<${NAME_FORMAT}>, actual=<${ch}>`,
          start,
        )
      }

      tokenError(`invalid token character: expected=<identifier|syntax-token>, actual=<${ch}>`, pos)
    } else {
      // --- タグ外部 ---

      // 開始デリミタにマッチするか確認
      const entry = openingLookup.get(ch)
      if (entry) {
        const closing = entry.closing

        // 次の非空白文字が "/" なら LT_SLASH、そうでなければ LT
        let lookAhead = pos + 1
        while (lookAhead < len && isWhitespace(input[lookAhead])) lookAhead++

        if (lookAhead < len && input[lookAhead] === "/") {
          emit("LT_SLASH", ch + "/", start, entry.pairIndex)
          pos = lookAhead + 1
        } else {
          emit("LT", ch, start, entry.pairIndex)
          pos += 1
        }

        insideTag = true
        currentClosing = closing
        currentPairIndex = entry.pairIndex
        continue
      }

      // デリミタ以外の文字はタグ外部では不正
      if (allDelimiterChars.has(ch)) {
        // closing デリミタがタグ外部に出現した場合
        tokenError(
          `invalid token character: expected=<identifier|syntax-token>, actual=<${ch}>`,
          pos,
        )
      }

      // 通常の不正文字
      tokenError(`invalid token character: expected=<identifier|syntax-token>, actual=<${ch}>`, pos)
    }
  }

  tokens.push({ kind: "EOF", value: "", position: pos })
  return tokens
}

// --- parse 内部ヘルパー ---

/**
 * パース時のエラーを送出する
 * @param message - エラーメッセージ
 * @param position - エラーが発生した入力文字列中の位置
 * @throws {Error} 常にエラーをスローする
 */
function parseError(message: string, position: number): never {
  throw new Error(`${message}, position=${position}`)
}

/**
 * PLACEHOLDER トークンをバリデーションし Placeholder オブジェクトを返す
 * @param phToken - バリデーション対象の PLACEHOLDER トークン
 * @param options - 正規化済みの機能オプション
 * @returns バリデーション済みの Placeholder オブジェクト
 * @throws {Error} placeholder が許可されていない、または形式が不正な場合
 */
function parsePlaceholder(phToken: Token, options: NormalizedOptions): Placeholder {
  if (!options.allowPlaceholders) {
    parseError(
      `placeholders are not allowed: found placeholder "${phToken.value}"`,
      phToken.position,
    )
  }
  const raw = phToken.value
  if (!raw.startsWith("$")) {
    parseError(`invalid placeholder: expected to start with "$", actual="${raw}"`, phToken.position)
  }
  const name = raw.slice(1)
  if (name.length === 0) {
    parseError(`invalid placeholder: name is empty in "${raw}"`, phToken.position)
  }
  if (!NAME_PATTERN.test(name)) {
    parseError(`invalid placeholder: name "${name}" contains invalid characters`, phToken.position)
  }
  return { type: "placeholder", name }
}

// --- parse 本体 ---

/**
 * トークン列をパースしてAST（ドキュメントノード）を生成する
 * @param tokens - tokenize関数で生成されたトークン列
 * @param options - 正規化済みの機能オプション
 * @returns ASTのルートであるドキュメントノード
 * @throws {Error} 構文エラー（タグの不一致・予期しないトークン等）がある場合
 */
function parse(tokens: Token[], options: NormalizedOptions): DocumentNode {
  const cursor = { value: 0 }

  // ネスト深さカウンタ
  let nestingDepth = 0

  // ドキュメント全体でのタグ名ごとのデリミタペア追跡（allowMixedDelimiters 検査用）
  const tagPairIndexMap = new Map<string, number>()
  // ドキュメント全体でのタグ名ごとの自己閉じ追跡（allowInconsistentClosures 検査用）
  const tagClosureMap = new Map<string, boolean>()

  function peek(): Token {
    return tokens[cursor.value]
  }

  function advance(): Token {
    return tokens[cursor.value++]
  }

  function expect(kind: TokenKind): Token {
    const tok = peek()
    if (tok.kind !== kind) {
      parseError(
        `unexpected token: expected=<${kind}>, actual=<${tok.kind}>, value="${tok.value}"`,
        tok.position,
      )
    }
    return advance()
  }

  function parseElement(): ElementNode {
    nestingDepth++
    if (nestingDepth > options.maxNestingDepth) {
      parseError(
        `nesting depth exceeded: max=${options.maxNestingDepth}`,
        peek().position,
      )
    }

    /** デリミタペアのインデックスを人間が読める文字列に変換する */
    const pairToStr = (idx: number) => {
      const pair = options.tags[idx]
      return `'${pair.opening}...${pair.closing}'`
    }

    const openLtToken = expect("LT")
    const openPairIndex = openLtToken.pairIndex
    const tagToken = expect("IDENT")
    const tagName = tagToken.value
    if (!isValidName(tagName)) {
      parseError(
        `invalid tag name: expected=<${NAME_FORMAT}>, actual=<${tagName}>`,
        tagToken.position,
      )
    }

    // allowMixedDelimiters チェック: 同一タグ名を別デリミタペアで使用していないか確認
    if (!options.allowMixedDelimiters && openPairIndex !== undefined) {
      const seenPairIndex = tagPairIndexMap.get(tagName)
      if (seenPairIndex === undefined) {
        tagPairIndexMap.set(tagName, openPairIndex)
      } else if (seenPairIndex !== openPairIndex) {
        parseError(
          `mixed delimiter pair for tag "${tagName}": first seen with ${pairToStr(seenPairIndex)}, now ${pairToStr(openPairIndex)}`,
          openLtToken.position,
        )
      }
    }

    // デコレーションと属性
    const decorations: Decoration[] = []
    const attributes: Record<string, AttributeValue> = {}
    while (peek().kind === "DOT_IDENT" || peek().kind === "IDENT") {
      if (peek().kind === "DOT_IDENT") {
        if (!options.allowDecorations) {
          parseError(
            `decorations are not allowed: found decoration "${peek().value}"`,
            peek().position,
          )
        }
        const deco = advance()
        const decoName = deco.value.slice(1)
        if (!isValidName(decoName)) {
          parseError(
            `invalid decoration name: expected=<${NAME_FORMAT}>, actual=<${decoName}>`,
            deco.position,
          )
        }
        decorations.push({ name: decoName })
      } else {
        const attrToken = advance()
        const attrName = attrToken.value
        if (!isValidName(attrName)) {
          parseError(
            `invalid attribute name: expected=<${NAME_FORMAT}>, actual=<${attrName}>`,
            attrToken.position,
          )
        }
        if (!options.allowAttributes) {
          parseError(`attributes are not allowed: found attribute "${attrName}"`, peek().position)
        }
        if (attrName in attributes) {
          parseError(
            `duplicate attribute: name="${attrName}"`,
            attrToken.position,
          )
        }
        expect("EQUALS")
        if (peek().kind === "LPAREN") {
          if (!options.allowGroup) {
            parseError(`groups are not allowed: found group at position`, peek().position)
          }
          // グループ値のパース
          advance() // LPAREN を消費
          const groupValues: (JsonValue | Placeholder)[] = []
          while (peek().kind !== "RPAREN") {
            if (groupValues.length > 0) {
              expect("COMMA")
            }
            if (peek().kind === "PLACEHOLDER") {
              const phToken = advance()
              groupValues.push(parsePlaceholder(phToken, options))
            } else {
              const jsonToken = expect("JSON_VALUE")
              const parsed = decodeJsonString(jsonToken.value)
              if (!parsed.success) {
                const detail = parsed.error.issues[0]!.message
                parseError(
                  `invalid json attribute: expected=<valid-json>, actual=<${jsonToken.value}>, attr=<${attrName}>, detail=<${detail}>`,
                  jsonToken.position,
                )
              }
              encodeJsonValue(parsed.data as JsonValue)
              groupValues.push(parsed.data as JsonValue)
            }
          }
          expect("RPAREN")
          const groupValue: GroupValue = { type: "group", values: groupValues }
          attributes[attrName] = groupValue
        } else if (peek().kind === "PLACEHOLDER") {
          const phToken = advance()
          attributes[attrName] = parsePlaceholder(phToken, options)
        } else {
          const jsonToken = expect("JSON_VALUE")
          const parsed = decodeJsonString(jsonToken.value)
          if (!parsed.success) {
            const detail = parsed.error.issues[0]!.message
            parseError(
              `invalid json attribute: expected=<valid-json>, actual=<${jsonToken.value}>, attr=<${attrName}>, detail=<${detail}>`,
              jsonToken.position,
            )
          }
          encodeJsonValue(parsed.data as JsonValue)
          attributes[attrName] = parsed.data as JsonValue
        }
      }
    }

    // 自己閉じ
    if (peek().kind === "SLASH_GT") {
      const slashGtToken = advance()
      if (
        openPairIndex !== undefined &&
        slashGtToken.pairIndex !== undefined &&
        openPairIndex !== slashGtToken.pairIndex
      ) {
        parseError(
          `mismatched delimiter pair for <${tagName}/>: expected=${pairToStr(openPairIndex)}, actual=${pairToStr(slashGtToken.pairIndex)}`,
          slashGtToken.position,
        )
      }
      // allowInconsistentClosures チェック: 以前 open/close で使われていないか確認
      if (!options.allowInconsistentClosures) {
        const seenSelfClosing = tagClosureMap.get(tagName)
        if (seenSelfClosing === undefined) {
          tagClosureMap.set(tagName, true)
        } else if (!seenSelfClosing) {
          parseError(
            `inconsistent closure for tag "${tagName}": previously used as open/close, now used as self-closing`,
            openLtToken.position,
          )
        }
      }
      nestingDepth--
      return {
        type: "element",
        tagName,
        decorations,
        attributes,
        children: [],
        selfClosing: true,
      }
    }

    expect("GT")

    // 子要素
    const children: ElementNode[] = []
    while (peek().kind === "LT") {
      children.push(parseElement())
    }

    // 閉じタグ
    if (peek().kind === "EOF") {
      parseError(`missing closing tag: expected=</${tagName}>, actual=<eof>`, peek().position)
    }

    const closeLtSlashToken = expect("LT_SLASH")
    const closePairIndex = closeLtSlashToken.pairIndex
    const closeTag = expect("IDENT")
    if (!isValidName(closeTag.value)) {
      parseError(
        `invalid tag name: expected=<${NAME_FORMAT}>, actual=<${closeTag.value}>`,
        closeTag.position,
      )
    }
    if (closeTag.value !== tagName) {
      parseError(
        `mismatched closing tag: expected=</${tagName}>, actual=</${closeTag.value}>`,
        closeTag.position,
      )
    }
    if (
      openPairIndex !== undefined &&
      closePairIndex !== undefined &&
      openPairIndex !== closePairIndex
    ) {
      parseError(
        `mismatched delimiter pair for <${tagName}>: expected=${pairToStr(openPairIndex)}, actual=${pairToStr(closePairIndex)}`,
        closeLtSlashToken.position,
      )
    }
    expect("GT")

    // allowInconsistentClosures チェック: 以前 self-closing で使われていないか確認
    if (!options.allowInconsistentClosures) {
      const seenSelfClosing = tagClosureMap.get(tagName)
      if (seenSelfClosing === undefined) {
        tagClosureMap.set(tagName, false)
      } else if (seenSelfClosing) {
        parseError(
          `inconsistent closure for tag "${tagName}": previously used as self-closing, now used as open/close`,
          closeLtSlashToken.position,
        )
      }
    }

    nestingDepth--
    return {
      type: "element",
      tagName,
      decorations,
      attributes,
      children,
      selfClosing: false,
    }
  }

  function parseDocument(): DocumentNode {
    const children: ElementNode[] = []
    while (peek().kind !== "EOF") {
      if (peek().kind === "LT_SLASH") {
        parseError(
          `unexpected closing tag at document root: expected=<element>, actual=<${peek().kind}>`,
          peek().position,
        )
      }
      children.push(parseElement())
    }
    return { type: "document", children }
  }

  return parseDocument()
}

// --- 公開クラス ---

/**
 * onlytag パーサーのメインクラス。オプションに従い入力を解析する
 */
export class onlytag {
  /** 正規化済みのオプション */
  private readonly normalizedOptions: NormalizedOptions

  /**
   * @param options - 機能オプション。省略時は全機能を許可
   */
  constructor(options?: Options) {
    this.normalizedOptions = normalizeOptions(options)
  }

  /**
   * 入力文字列をトークン列に分割する
   * @param input - onlytag マークアップの入力文字列
   * @returns トークンの配列
   */
  tokenize(input: string): Token[] {
    return tokenize(input, this.normalizedOptions)
  }

  /**
   * トークン列を AST に変換する
   * @param tokens - tokenize で生成されたトークン列
   * @returns ドキュメントノード
   */
  parse(tokens: Token[]): DocumentNode {
    return parse(tokens, this.normalizedOptions)
  }

  /**
   * ドキュメントノードを JSON 文字列にシリアライズする
   * @param doc - シリアライズ対象のドキュメントノード
   * @returns JSON 文字列
   */
  dump(doc: DocumentNode): string {
    return JSON.stringify(doc)
  }

}
