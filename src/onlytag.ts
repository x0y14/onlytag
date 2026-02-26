import type { Token, TokenKind } from "./token.js"
import type {
  DocumentNode,
  ElementNode,
  Decoration,
  JsonValue,
  Placeholder,
  AttributeValue,
} from "./ast.js"
import { DocumentNodeSchema } from "./ast.js"
import type { Options, NormalizedOptions, TagDelimiterPair } from "./types.js"
import { normalizeOptions } from "./types.js"
import { decodeJsonString, encodeJsonValue } from "./utils.js"

/** タグ名のバリデーションパターン */
const TAG_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9-]*$/
/** プレースホルダー先頭文字のバリデーションパターン */
const PLACEHOLDER_FIRST_CHAR_PATTERN = /[a-zA-Z]/
/** プレースホルダー後続文字のバリデーションパターン */
const PLACEHOLDER_CHAR_PATTERN = /[a-zA-Z0-9-]/
/** プレースホルダー名のバリデーションパターン */
const PLACEHOLDER_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9-]*$/

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
 * 文字が識別子に使用可能な文字（英数字・アンダースコア・ハイフン）かどうかを判定する
 * @param ch - 判定対象の1文字
 * @returns 識別子文字であればtrue
 */
function isIdentChar(ch: string): boolean {
  const c = ch.charCodeAt(0)
  return (
    (c >= 65 && c <= 90) || // 英大文字
    (c >= 97 && c <= 122) || // 英小文字
    (c >= 48 && c <= 57) || // 数字
    c === 95 || // _
    c === 45 // -
  )
}

/**
 * 文字列がタグ名として有効かどうかを判定する（[a-zA-Z][a-zA-Z0-9-]*）
 * @param name - 判定対象の文字列
 * @returns 有効なタグ名であればtrue
 */
function isValidTagName(name: string): boolean {
  return TAG_NAME_PATTERN.test(name)
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
 * @returns 境界であればtrue
 */
function isJsonBoundary(input: string, end: number, closing: string): boolean {
  const len = input.length
  if (end >= len) return true
  const ch = input[end]
  if (isWhitespace(ch) || ch === closing) return true
  if (ch === "/" && end + 1 < len && input[end + 1] === closing) return true
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
 * 入力文字列からJSON値を読み取る。境界位置まで貪欲にマッチを試みる
 * @param input - 入力文字列全体
 * @param pos - 読み取り開始位置
 * @param closing - 現在のタグの閉じデリミタ文字
 * @returns JSON値の生文字列と読み取り後の位置のタプル
 * @throws {Error} JSON値が見つからない、または不正な場合
 */
function readJsonValue(input: string, pos: number, closing: string): [value: string, newPos: number] {
  const len = input.length

  // 属性値の前にある空白を読み飛ばす
  while (pos < len && isWhitespace(input[pos])) pos++

  if (pos >= len) {
    tokenError("missing attribute value: expected=<json-value>, actual=<eof>", pos)
  }

  if (isJsonBoundary(input, pos, closing)) {
    const actual = input[pos] === "/" ? "/" + closing : input[pos]
    tokenError(`missing attribute value: expected=<json-value>, actual=<${actual}>`, pos)
  }

  if (!canStartJsonValue(input[pos])) {
    tokenError(`invalid json value start: expected=<json-start>, actual=<${input[pos]}>`, pos)
  }

  let lastDecodeIssue = "invalid json"
  for (let end = pos + 1; end <= len; end++) {
    if (!isJsonBoundary(input, end, closing)) continue
    const candidate = input.slice(pos, end)
    const result = decodeJsonString(candidate)
    if (result.success) {
      return [candidate, end]
    }
    lastDecodeIssue = result.error.issues[0]?.message ?? "invalid json"
  }

  tokenError(
    `invalid json attribute value: expected=<valid-json>, actual=<${readLiteralPreview(input, pos, closing)}>, detail=<${lastDecodeIssue}>`,
    pos,
  )
}

/**
 * 入力文字列から placeholder を読み取る。$[a-zA-Z][a-zA-Z0-9-]* の形式
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

  if (pos >= len || !PLACEHOLDER_FIRST_CHAR_PATTERN.test(input[pos])) {
    const actual = pos < len ? input[pos] : "<eof>"
    tokenError(`invalid placeholder: expected=<$[a-zA-Z][a-zA-Z0-9-]*>, actual=<$${actual}>`, start)
  }

  while (pos < len && PLACEHOLDER_CHAR_PATTERN.test(input[pos])) pos++

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

    // EQUALS の直後は JSON 値または placeholder として読む
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
      } else {
        const [value, newPos] = readJsonValue(input, pos, currentClosing!)
        emit("JSON_VALUE", value, start)
        pos = newPos
      }
      continue
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
        if (pos < len && isIdentChar(input[pos])) {
          if (!options.allowDecorations) {
            tokenError(`decorations are not allowed: found decoration at position`, start)
          }
          const identStart = pos
          while (pos < len && isIdentChar(input[pos])) pos++
          emit("DOT_IDENT", "." + input.slice(identStart, pos), start)
        } else {
          const actual = pos < len ? `.${input[pos]}` : ".<eof>"
          tokenError(
            `invalid decoration token: expected=<.[A-Za-z0-9_-]+>, actual=<${actual}>`,
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

      if (isIdentChar(ch)) {
        while (pos < len && isIdentChar(input[pos])) pos++
        emit("IDENT", input.slice(start, pos), start)
        continue
      }

      tokenError(
        `invalid token character: expected=<identifier|syntax-token>, actual=<${ch}>`,
        pos,
      )
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
      tokenError(
        `invalid token character: expected=<identifier|syntax-token>, actual=<${ch}>`,
        pos,
      )
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
    const openLtToken = expect("LT")
    const openPairIndex = openLtToken.pairIndex
    const tagToken = expect("IDENT")
    const tagName = tagToken.value
    if (!isValidTagName(tagName)) {
      parseError(
        `invalid tag name: expected=<[a-zA-Z][a-zA-Z0-9-]*>, actual=<${tagName}>`,
        tagToken.position,
      )
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
        decorations.push({ name: deco.value.slice(1) })
      } else {
        const attrName = advance().value
        if (!options.allowAttributes) {
          parseError(`attributes are not allowed: found attribute "${attrName}"`, peek().position)
        }
        expect("EQUALS")
        if (peek().kind === "PLACEHOLDER") {
          if (!options.allowPlaceholders) {
            parseError(
              `placeholders are not allowed: found placeholder "${peek().value}"`,
              peek().position,
            )
          }
          const phToken = advance()
          const raw = phToken.value
          // validate placeholder token format: must start with "$" and have a valid name
          if (!raw.startsWith("$")) {
            parseError(
              `invalid placeholder: expected to start with "$", actual="${raw}"`,
              phToken.position,
            )
          }
          const name = raw.slice(1)
          if (name.length === 0) {
            parseError(
              `invalid placeholder: name is empty in "${raw}"`,
              phToken.position,
            )
          }
          if (!PLACEHOLDER_NAME_PATTERN.test(name)) {
            parseError(
              `invalid placeholder: name "${name}" contains invalid characters`,
              phToken.position,
            )
          }
          const placeholder: Placeholder = { type: "placeholder", name }
          attributes[attrName] = placeholder
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
      if (openPairIndex !== undefined && slashGtToken.pairIndex !== undefined
        && openPairIndex !== slashGtToken.pairIndex) {
        parseError(
          `mismatched delimiter pair for <${tagName}/>: expected=<pairIndex=${openPairIndex}>, actual=<pairIndex=${slashGtToken.pairIndex}>`,
          slashGtToken.position,
        )
      }
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
    if (!isValidTagName(closeTag.value)) {
      parseError(
        `invalid tag name: expected=<[a-zA-Z][a-zA-Z0-9-]*>, actual=<${closeTag.value}>`,
        closeTag.position,
      )
    }
    if (closeTag.value !== tagName) {
      parseError(
        `mismatched closing tag: expected=</${tagName}>, actual=</${closeTag.value}>`,
        closeTag.position,
      )
    }
    if (openPairIndex !== undefined && closePairIndex !== undefined && openPairIndex !== closePairIndex) {
      parseError(
        `mismatched delimiter pair for <${tagName}>: expected=<pairIndex=${openPairIndex}>, actual=<pairIndex=${closePairIndex}>`,
        closeLtSlashToken.position,
      )
    }
    expect("GT")

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

  /**
   * JSON 文字列をパースしてドキュメントノードを返す
   * @param json - JSON 文字列
   * @returns ドキュメントノード
   * @throws {Error} JSON が不正、またはドキュメントノードのスキーマに合致しない場合
   */
  load(json: string): DocumentNode {
    let parsed: unknown
    try {
      parsed = JSON.parse(json)
    } catch (e) {
      throw new Error(`invalid json: ${e instanceof Error ? e.message : String(e)}`)
    }
    const result = DocumentNodeSchema.safeParse(parsed)
    if (!result.success) {
      throw new Error(`invalid document node: ${result.error.message}`)
    }
    return result.data
  }
}
