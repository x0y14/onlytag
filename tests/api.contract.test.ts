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
  assert.equal(doc.children[0].name, "A")
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
    name: "A",
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
  assert.equal(parsed.children[0].name, "A")
  assert.equal(parsed.children[0].decorations[0], "bold")
  assert.equal(parsed.children[0].attributes.text, "hello")
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

// --- dump() ラウンドトリップテスト ---

// tokenize → parse → dump → JSON.parse で AST 構造が保持されることを確認する
test("api contract: round-trip preserves AST structure", () => {
  const ot = new onlytag()
  const input = `
    <Page .main>
      <Header .bold title="Hello" count=42 active=true empty=null />
      <List items=[1, "two", 3] config={"key": "value", "nested": [true]} />
      <Ref action=$handler />
      <Group filter=($mode, "dark", 1) />
    </Page>
  `
  const tokens = ot.tokenize(input)
  const doc = ot.parse(tokens)
  const json = ot.dump(doc)
  const restored = JSON.parse(json)

  assert.deepStrictEqual(restored, doc)
})

// dump → JSON.parse → dump を2回適用して同一結果であることを確認する（冪等性）
test("api contract: dump is idempotent", () => {
  const ot = new onlytag()
  const input = '<Container .elevated level=99 label="test" nested={"a": [1, 2]} />'
  const doc = ot.parse(ot.tokenize(input))

  const firstDump = ot.dump(doc)
  const secondDump = ot.dump(JSON.parse(firstDump))

  assert.strictEqual(firstDump, secondDump)
})

// 全属性値型が dump 後も型と値を保持していることを確認する
test("api contract: dump preserves all attribute value types", () => {
  const ot = new onlytag()
  const input = `
    <Tag
      str="hello world"
      num=3.14
      int=0
      negative=-42
      boolTrue=true
      boolFalse=false
      nil=null
      arr=[1, "two", true, null]
      obj={"key": "value", "num": 1}
      placeholder=$myVar
      group=($ref, "literal", 100)
    />
  `
  const doc = ot.parse(ot.tokenize(input))
  const restored = JSON.parse(ot.dump(doc))
  const attributes = restored.children[0].attributes

  // 文字列
  assert.strictEqual(attributes.str, "hello world")
  assert.strictEqual(typeof attributes.str, "string")

  // 数値
  assert.strictEqual(attributes.num, 3.14)
  assert.strictEqual(typeof attributes.num, "number")
  assert.strictEqual(attributes.int, 0)
  assert.strictEqual(attributes.negative, -42)

  // 真偽値
  assert.strictEqual(attributes.boolTrue, true)
  assert.strictEqual(typeof attributes.boolTrue, "boolean")
  assert.strictEqual(attributes.boolFalse, false)

  // null
  assert.isNull(attributes.nil)

  // 配列
  assert.isArray(attributes.arr)
  assert.deepStrictEqual(attributes.arr, [1, "two", true, null])

  // オブジェクト
  assert.isObject(attributes.obj)
  assert.deepStrictEqual(attributes.obj, { key: "value", num: 1 })

  // placeholder
  assert.deepStrictEqual(attributes.placeholder, { type: "placeholder", name: "myVar" })

  // グループ値
  assert.strictEqual(attributes.group.type, "group")
  assert.deepStrictEqual(attributes.group.values, [
    { type: "placeholder", name: "ref" },
    "literal",
    100,
  ])
})
