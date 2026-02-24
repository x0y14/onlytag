import type { Token, TokenKind } from "./token.js"
import { decodeJsonString } from "./utils.js"

// --- 内部ヘルパー ---

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

// --- 公開API ---

/**
 * 入力文字列をトークン列に分割する
 * @param input - onlytagマークアップの入力文字列
 * @returns トークンの配列。末尾にEOFトークンを含む
 * @throws {Error} 不正な文字やトークンが含まれる場合
 */
export function tokenize(input: string): Token[] {
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
        emit("EQUALS", "=", start)
        pos += 1
        break

      case ".":
        pos += 1
        if (pos < len && isIdentChar(input[pos])) {
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
