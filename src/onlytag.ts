import type { Token, TokenKind } from "./token.js"
import type { DocumentNode, ElementNode, Decoration, JsonValue } from "./ast.js"
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
 * @returns 境界であればtrue
 */
function isJsonBoundary(input: string, end: number): boolean {
  const len = input.length
  if (end >= len) return true
  const ch = input[end]
  if (isWhitespace(ch) || ch === ">") return true
  if (ch === "/" && end + 1 < len && input[end + 1] === ">") return true
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
 * @returns プレビュー文字列。入力末尾の場合は`"<eof>"`
 */
function readLiteralPreview(input: string, pos: number): string {
  const len = input.length
  let i = pos
  while (i < len) {
    const ch = input[i]
    if (isWhitespace(ch) || ch === "<" || ch === ">" || ch === "/" || ch === "=") break
    i++
  }
  if (i === pos) return "<eof>"
  return input.slice(pos, i)
}

/**
 * 入力文字列からJSON値を読み取る。境界位置まで貪欲にマッチを試みる
 * @param input - 入力文字列全体
 * @param pos - 読み取り開始位置
 * @returns JSON値の生文字列と読み取り後の位置のタプル
 * @throws {Error} JSON値が見つからない、または不正な場合
 */
function readJsonValue(input: string, pos: number): [value: string, newPos: number] {
  const len = input.length

  // 属性値の前にある空白を読み飛ばす
  while (pos < len && isWhitespace(input[pos])) pos++

  if (pos >= len) {
    tokenError("missing attribute value: expected=<json-value>, actual=<eof>", pos)
  }

  if (isJsonBoundary(input, pos)) {
    const actual = input[pos] === "/" ? "/>" : input[pos]
    tokenError(`missing attribute value: expected=<json-value>, actual=<${actual}>`, pos)
  }

  if (!canStartJsonValue(input[pos])) {
    tokenError(`invalid json value start: expected=<json-start>, actual=<${input[pos]}>`, pos)
  }

  let lastDecodeIssue = "invalid json"
  for (let end = pos + 1; end <= len; end++) {
    if (!isJsonBoundary(input, end)) continue
    const candidate = input.slice(pos, end)
    const result = decodeJsonString(candidate)
    if (result.success) {
      return [candidate, end]
    }
    lastDecodeIssue = result.error.issues[0]?.message ?? "invalid json"
  }

  tokenError(
    `invalid json attribute value: expected=<valid-json>, actual=<${readLiteralPreview(input, pos)}>, detail=<${lastDecodeIssue}>`,
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
      const [value, newPos] = readJsonValue(input, pos)
      emit("JSON_VALUE", value, start)
      pos = newPos
      continue
    }

    if (pos >= len) break

    const start = pos

    const ch = input[pos]

    switch (ch) {
      case "<":
        if (pos + 1 < len && input[pos + 1] === "/") {
          emit("LT_SLASH", "</", start)
          pos += 2
        } else {
          emit("LT", "<", start)
          pos += 1
        }
        break

      case ">":
        emit("GT", ">", start)
        pos += 1
        break

      case "/":
        if (pos + 1 < len && input[pos + 1] === ">") {
          emit("SLASH_GT", "/>", start)
          pos += 2
        } else {
          const next = pos + 1 < len ? input[pos + 1] : "<eof>"
          tokenError(`invalid slash token: expected=</>, actual=</${next}>`, pos)
        }
        break

      case "=":
        // attribute が禁止されている場合は即座にエラー
        if (!options.allowAttributes) {
          tokenError(`attributes are not allowed: found attribute at position`, start)
        }
        emit("EQUALS", "=", start)
        pos += 1
        break

      case ".":
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
        break

      default:
        if (isIdentChar(ch)) {
          while (pos < len && isIdentChar(input[pos])) pos++
          emit("IDENT", input.slice(start, pos), start)
        } else {
          tokenError(
            `invalid token character: expected=<identifier|syntax-token>, actual=<${ch}>`,
            pos,
          )
        }
        break
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
    expect("LT")
    const tagToken = expect("IDENT")
    const tagName = tagToken.value
    if (!/^[A-Za-z_]([A-Za-z0-9_-]*[A-Za-z0-9_])?$/.test(tagName)) {
      parseError(
        `invalid tag name: expected=<[A-Za-z_]([A-Za-z0-9_-]*[A-Za-z0-9_])?>, actual=<${tagName}>`,
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

    expect("LT_SLASH")
    const closeTag = expect("IDENT")
    if (closeTag.value !== tagName) {
      parseError(
        `mismatched closing tag: expected=</${tagName}>, actual=</${closeTag.value}>`,
        closeTag.position,
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
}
