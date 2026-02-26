import type { Token, TokenKind } from "./token.js"
import type { DocumentNode, ElementNode, Decoration, JsonValue } from "./ast.js"
import { DocumentNodeSchema } from "./ast.js"
import type { Options, NormalizedOptions } from "./types.js"
import { normalizeOptions } from "./types.js"
import { decodeJsonString, encodeJsonValue } from "./utils.js"

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
  return /^[a-zA-Z][a-zA-Z0-9-]*$/.test(name)
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
 * 指定位置がJSON値の境界（空白・タグ閉じ・入力末尾）かどうかを判定する
 * @param input - 入力文字列全体
 * @param end - 判定対象の位置
 * @param closingChars - 終了デリミタ文字の集合
 * @returns 境界であればtrue
 */
function isJsonBoundary(input: string, end: number, closingChars: Set<string>): boolean {
  const len = input.length
  if (end >= len) return true
  const ch = input[end]
  if (isWhitespace(ch) || closingChars.has(ch)) return true
  if (ch === "/" && end + 1 < len && closingChars.has(input[end + 1])) return true
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
 * @param delimChars - 区切り文字の集合（開始・終了デリミタの両方を含む）
 * @returns プレビュー文字列。入力末尾の場合は`"<eof>"`
 */
function readLiteralPreview(input: string, pos: number, delimChars: Set<string>): string {
  const len = input.length
  let i = pos
  while (i < len) {
    const ch = input[i]
    if (isWhitespace(ch) || delimChars.has(ch) || ch === "/" || ch === "=") break
    i++
  }
  if (i === pos) return "<eof>"
  return input.slice(pos, i)
}

/**
 * 入力文字列からJSON値を読み取る。境界位置まで貪欲にマッチを試みる
 * @param input - 入力文字列全体
 * @param pos - 読み取り開始位置
 * @param closingChars - 終了デリミタ文字の集合
 * @param delimChars - 全区切り文字の集合（エラーメッセージ用）
 * @returns JSON値の生文字列と読み取り後の位置のタプル
 * @throws {Error} JSON値が見つからない、または不正な場合
 */
function readJsonValue(
  input: string,
  pos: number,
  closingChars: Set<string>,
  delimChars: Set<string>,
): [value: string, newPos: number] {
  const len = input.length

  // 属性値の前にある空白を読み飛ばす
  while (pos < len && isWhitespace(input[pos])) pos++

  if (pos >= len) {
    tokenError("missing attribute value: expected=<json-value>, actual=<eof>", pos)
  }

  if (isJsonBoundary(input, pos, closingChars)) {
    const actual = input[pos] === "/" ? "/>" : input[pos]
    tokenError(`missing attribute value: expected=<json-value>, actual=<${actual}>`, pos)
  }

  if (!canStartJsonValue(input[pos])) {
    tokenError(`invalid json value start: expected=<json-start>, actual=<${input[pos]}>`, pos)
  }

  let lastDecodeIssue = "invalid json"
  for (let end = pos + 1; end <= len; end++) {
    if (!isJsonBoundary(input, end, closingChars)) continue
    const candidate = input.slice(pos, end)
    const result = decodeJsonString(candidate)
    if (result.success) {
      return [candidate, end]
    }
    lastDecodeIssue = result.error.issues[0]?.message ?? "invalid json"
  }

  tokenError(
    `invalid json attribute value: expected=<valid-json>, actual=<${readLiteralPreview(input, pos, delimChars)}>, detail=<${lastDecodeIssue}>`,
    pos,
  )
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

  const openingChars = new Set(options.tags.map((t) => t.opening))
  const closingChars = new Set(options.tags.map((t) => t.closing))
  const delimChars = new Set([...openingChars, ...closingChars])

  function emit(kind: TokenKind, value: string, position: number) {
    tokens.push({ kind, value, position })
    lastKind = kind
  }

  while (true) {
    // 空白を読み飛ばす
    while (pos < len && isWhitespace(input[pos])) pos++

    // EQUALS の直後は JSON 値として読む
    if (lastKind === "EQUALS") {
      const start = pos
      const [value, newPos] = readJsonValue(input, pos, closingChars, delimChars)
      emit("JSON_VALUE", value, start)
      pos = newPos
      continue
    }

    if (pos >= len) break

    const start = pos

    const ch = input[pos]

    // タグヘッダ内かどうか（lastKind で判定）
    const insideTag = lastKind !== null && lastKind !== "GT" && lastKind !== "SLASH_GT"

    if (insideTag && ch === "/" && pos + 1 < len && closingChars.has(input[pos + 1])) {
      // 自己閉じ: /closingChar
      emit("SLASH_GT", ch + input[pos + 1], start)
      pos += 2
    } else if (insideTag && closingChars.has(ch)) {
      // タグ閉じ
      emit("GT", ch, start)
      pos += 1
    } else if (!insideTag && openingChars.has(ch)) {
      // タグ開き: openingChar または openingChar/
      let ltLookAhead = pos + 1
      while (ltLookAhead < len && isWhitespace(input[ltLookAhead])) ltLookAhead++
      if (ltLookAhead < len && input[ltLookAhead] === "/") {
        emit("LT_SLASH", ch + "/", start)
        pos = ltLookAhead + 1
      } else {
        emit("LT", ch, start)
        pos += 1
      }
    } else if (ch === "=") {
      // attribute が禁止されている場合は即座にエラー
      if (!options.allowAttributes) {
        tokenError(`attributes are not allowed: found attribute at position`, start)
      }
      emit("EQUALS", "=", start)
      pos += 1
    } else if (ch === ".") {
      pos += 1
      if (pos < len && isIdentChar(input[pos])) {
        // decoration が禁止されている場合は即座にエラー
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
    } else if (isIdentChar(ch)) {
      while (pos < len && isIdentChar(input[pos])) pos++
      emit("IDENT", input.slice(start, pos), start)
    } else {
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

  // 開始デリミタ → 終了デリミタのマップ
  const closingForOpening = new Map(options.tags.map((t) => [t.opening, t.closing]))

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
    const ltToken = expect("LT")
    const openingChar = ltToken.value
    const expectedClosing = closingForOpening.get(openingChar) ?? openingChar

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
    const attributes: Record<string, JsonValue> = {}
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

    // 自己閉じ
    if (peek().kind === "SLASH_GT") {
      const slashGtTok = peek()
      const actualClosing = slashGtTok.value[1]
      if (actualClosing !== expectedClosing) {
        parseError(
          `mismatched tag delimiter: opening="${openingChar}", expected closing="${expectedClosing}", actual="${slashGtTok.value}"`,
          slashGtTok.position,
        )
      }
      advance()
      return {
        type: "element",
        tagName,
        decorations,
        attributes,
        children: [],
        selfClosing: true,
      }
    }

    const gtTok = peek()
    if (gtTok.kind === "GT" && gtTok.value !== expectedClosing) {
      parseError(
        `mismatched tag delimiter: opening="${openingChar}", expected closing="${expectedClosing}", actual="${gtTok.value}"`,
        gtTok.position,
      )
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

    const ltSlashTok = peek()
    if (ltSlashTok.kind === "LT_SLASH" && ltSlashTok.value[0] !== openingChar) {
      parseError(
        `mismatched closing tag delimiter: opening="${openingChar}", actual="${ltSlashTok.value}"`,
        ltSlashTok.position,
      )
    }
    expect("LT_SLASH")
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
    const finalGtTok = peek()
    if (finalGtTok.kind === "GT" && finalGtTok.value !== expectedClosing) {
      parseError(
        `mismatched tag delimiter: opening="${openingChar}", expected closing="${expectedClosing}", actual="${finalGtTok.value}"`,
        finalGtTok.position,
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
