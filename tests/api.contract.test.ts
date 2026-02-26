import { test, assert } from "vitest"
import * as onlytagModule from "../src/index.js"
import { onlytag } from "../src/onlytag.js"

// 公開APIの必須エクスポートが存在することを確認する
test("api contract: exports required symbols", () => {
  assert.isFunction(onlytagModule.onlytag)
  assert.isDefined(onlytagModule.TokenSchema)
  assert.isDefined(onlytagModule.TokenKind)
  assert.isDefined(onlytagModule.JsonValueSchema)
  assert.isDefined(onlytagModule.DecorationSchema)
  assert.isDefined(onlytagModule.PlaceholderSchema)
  assert.isDefined(onlytagModule.AttributeValueSchema)
  assert.isDefined(onlytagModule.ElementNodeSchema)
  assert.isDefined(onlytagModule.DocumentNodeSchema)
})

// 空文字列を tokenize した場合に EOF のみが返ることを確認する
test("api contract: tokenize returns eof for empty input", () => {
  const ot = new onlytag()
  const tokens = ot.tokenize("")
  assert.equal(tokens.length, 1)
  assert.equal(tokens[0].kind, "EOF")
})

// parse の戻り値が document ノードであることを確認する
test("api contract: parse returns document node", () => {
  const ot = new onlytag()
  const tokens = ot.tokenize("<A />")
  const doc = ot.parse(tokens)
  assert.equal(doc.type, "document")
  assert.equal(doc.children.length, 1)
  assert.equal(doc.children[0].tagName, "A")
})

// 公開されているスキーマが最小構成の値を受理することを確認する
test("api contract: schemas accept minimal valid values", () => {
  const tokenResult = onlytagModule.TokenSchema.safeParse({
    kind: "EOF",
    value: "",
    position: 0,
  })
  assert.isTrue(tokenResult.success)

  const elementResult = onlytagModule.ElementNodeSchema.safeParse({
    type: "element",
    tagName: "A",
    decorations: [],
    attributes: {},
    children: [],
    selfClosing: true,
  })
  assert.isTrue(elementResult.success)
})

// onlytag class が export されていることを確認する
test("api contract: exports onlytag class", () => {
  assert.isFunction(onlytagModule.onlytag)
  const ot = new onlytagModule.onlytag()
  assert.isFunction(ot.tokenize)
  assert.isFunction(ot.parse)
  assert.isFunction(ot.dump)
  assert.isFunction(ot.load)
})

// Options 関連の export を確認する
test("api contract: exports feature options utilities", () => {
  assert.isFunction(onlytagModule.normalizeOptions)
  assert.isDefined(onlytagModule.NormalizedOptionsSchema)
})

// 部分指定でインスタンス生成可能なことを確認する
test("api contract: onlytag accepts partial feature options", () => {
  const ot1 = new onlytag({ allowDecorations: false })
  assert.isFunction(ot1.tokenize)

  const ot2 = new onlytag({})
  assert.isFunction(ot2.tokenize)

  const ot3 = new onlytag()
  assert.isFunction(ot3.tokenize)
})

// dump でドキュメントノードを JSON 文字列にシリアライズできることを確認する
test("api contract: dump serializes document node to json string", () => {
  const ot = new onlytag()
  const doc = ot.parse(ot.tokenize('<A .bold text="hello" />'))
  const json = ot.dump(doc)
  const parsed = JSON.parse(json)
  assert.equal(parsed.type, "document")
  assert.equal(parsed.children.length, 1)
  assert.equal(parsed.children[0].tagName, "A")
  assert.equal(parsed.children[0].decorations[0].name, "bold")
  assert.equal(parsed.children[0].attributes.text, "hello")
})

// load で JSON 文字列をドキュメントノードにデシリアライズできることを確認する
test("api contract: load deserializes json string to document node", () => {
  const ot = new onlytag()
  const json = JSON.stringify({
    type: "document",
    children: [
      {
        type: "element",
        tagName: "A",
        decorations: [],
        attributes: { x: 1 },
        children: [],
        selfClosing: true,
      },
    ],
  })
  const doc = ot.load(json)
  assert.equal(doc.type, "document")
  assert.equal(doc.children.length, 1)
  assert.equal(doc.children[0].tagName, "A")
  assert.equal(doc.children[0].attributes.x, 1)
})

// dump -> load のラウンドトリップが元の値を復元できることを確認する
test("api contract: dump and load are inverse operations (round-trip)", () => {
  const ot = new onlytag()
  const doc = ot.parse(ot.tokenize('<A .bold text="hello"><B /></A>'))
  const json = ot.dump(doc)
  const loaded = ot.load(json)
  assert.deepEqual(loaded, doc)
})

// load で不正な JSON を渡すとエラーになることを確認する
test("api contract: load throws on invalid json", () => {
  const ot = new onlytag()
  assert.throws(() => ot.load("not json"), /invalid json/)
})

// load でスキーマに合致しない JSON を渡すとエラーになることを確認する
test("api contract: load throws on json not matching document node schema", () => {
  const ot = new onlytag()
  assert.throws(() => ot.load('{"type":"unknown"}'), /invalid document node/)
})

// placeholder を含む dump/load ラウンドトリップが元の値を復元できることを確認する
test("api contract: dump and load round-trip preserves placeholder", () => {
  const ot = new onlytag()
  const doc = ot.parse(ot.tokenize("<A attr=$myValue />"))
  const json = ot.dump(doc)
  const loaded = ot.load(json)
  assert.deepEqual(loaded, doc)
  assert.deepStrictEqual(loaded.children[0].attributes["attr"], {
    type: "placeholder",
    name: "myValue",
  })
})

// PlaceholderSchema が有効な placeholder を受理することを確認する
test("api contract: PlaceholderSchema accepts valid placeholder", () => {
  const result = onlytagModule.PlaceholderSchema.safeParse({ type: "placeholder", name: "abc" })
  assert.isTrue(result.success)
})

// PlaceholderSchema が不正な名前を拒否することを確認する
test("api contract: PlaceholderSchema rejects invalid name", () => {
  const result = onlytagModule.PlaceholderSchema.safeParse({ type: "placeholder", name: "1abc" })
  assert.isFalse(result.success)
})
