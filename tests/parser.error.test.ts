import { test, assert } from "vitest"
import { onlytag } from "../src/onlytag.js"
import type { Token } from "../src/token.js"

const ot = new onlytag()

function expectParserErrorWithPosition(input: string): void {
  let error: unknown
  try {
    ot.parse(ot.tokenize(input))
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /position|pos|index|offset/i)
}

// 閉じタグ名が一致しない入力は失敗することを確認する
test("parser error: mismatched closing tag fails", () => {
  expectParserErrorWithPosition("<A></B>")
})

// 余分な閉じタグのみの入力は失敗することを確認する
test("parser error: stray closing tag fails", () => {
  expectParserErrorWithPosition("</A>")
})

// 閉じタグが欠落した入力は失敗することを確認する
test("parser error: missing closing tag fails", () => {
  expectParserErrorWithPosition("<A><B /></A")
})

// ネスト構造で閉じタグが不一致の入力は失敗することを確認する
test("parser error: nested closing tag mismatch fails", () => {
  expectParserErrorWithPosition("<A><B></A></B>")
})

// 自己閉じタグの後に余分な閉じタグがある入力は失敗することを確認する
test("parser error: extra close tag after self-closing element fails", () => {
  expectParserErrorWithPosition("<A /></A>")
})

// EOF到達時に閉じタグ不足なら失敗することを確認する
test("parser error: eof before closing tag fails", () => {
  expectParserErrorWithPosition("<A>")
})

// タグ名にアンダースコアを含む入力は失敗することを確認する
test("parser error: tag name with underscore fails", () => {
  expectParserErrorWithPosition("<A_b />")
})

// タグ名が数字で始まる入力は失敗することを確認する
test("parser error: tag name starting with digit fails", () => {
  expectParserErrorWithPosition("<1Tag />")
})
test("parser error: missing equals before decoration fails", () => {
  let error: unknown
  try {
    ot.parse(ot.tokenize("<A flag .hot />"))
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /expected=<EQUALS>, actual=<DOT_IDENT>/)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// 不正なJSON_VALUEトークンを含む場合にparse段で失敗することを確認する
test("parser error: invalid json token payload fails in parse stage", () => {
  const tokens: Token[] = [
    { kind: "LT", value: "<", position: 0 },
    { kind: "IDENT", value: "A", position: 1 },
    { kind: "IDENT", value: "config", position: 3 },
    { kind: "EQUALS", value: "=", position: 9 },
    { kind: "JSON_VALUE", value: "{", position: 10 },
    { kind: "SLASH_GT", value: "/>", position: 11 },
    { kind: "EOF", value: "", position: 13 },
  ]

  let error: unknown
  try {
    ot.parse(tokens)
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /invalid json attribute/i)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})
