import { test, assert } from "vitest"
import * as onlytag from "../src/index.js"

// 公開APIの必須エクスポートが存在することを確認する
test("api contract: exports required symbols", () => {
  assert.isFunction(onlytag.tokenize)
  assert.isFunction(onlytag.parse)
  assert.isDefined(onlytag.TokenSchema)
  assert.isDefined(onlytag.TokenKind)
  assert.isDefined(onlytag.JsonValueSchema)
  assert.isDefined(onlytag.DecorationSchema)
  assert.isDefined(onlytag.ElementNodeSchema)
  assert.isDefined(onlytag.DocumentNodeSchema)
})

// 空文字列を tokenize した場合に EOF のみが返ることを確認する
test("api contract: tokenize returns eof for empty input", () => {
  const tokens = onlytag.tokenize("")
  assert.equal(tokens.length, 1)
  assert.equal(tokens[0].kind, "EOF")
})

// parse の戻り値が document ノードであることを確認する
test("api contract: parse returns document node", () => {
  const tokens = onlytag.tokenize("<A />")
  const doc = onlytag.parse(tokens)
  assert.equal(doc.type, "document")
  assert.equal(doc.children.length, 1)
  assert.equal(doc.children[0].tagName, "A")
})

// 公開されているスキーマが最小構成の値を受理することを確認する
test("api contract: schemas accept minimal valid values", () => {
  const tokenResult = onlytag.TokenSchema.safeParse({
    kind: "EOF",
    value: "",
    position: 0,
  })
  assert.isTrue(tokenResult.success)

  const elementResult = onlytag.ElementNodeSchema.safeParse({
    type: "element",
    tagName: "A",
    decorations: [],
    attributes: {},
    children: [],
    selfClosing: true,
  })
  assert.isTrue(elementResult.success)
})
