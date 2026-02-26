import { test, assert } from "vitest"
import * as fc from "fast-check"
import {
  JsonValueSchema,
  DecorationSchema,
  ElementNodeSchema,
  DocumentNodeSchema,
  LogicArgSchema,
} from "../src/ast.js"
import { TokenSchema } from "../src/token.js"
import { NormalizedOptionsSchema } from "../src/types.js"

// --- JsonValue関連 ---

const jsonValueArb: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof(
    fc.string(),
    fc.double({ noNaN: true, noDefaultInfinity: true }),
    fc.integer(),
    fc.boolean(),
    fc.constant(null),
    fc.array(tie("value"), { maxLength: 3, size: "small" }),
    fc.dictionary(fc.string(), tie("value"), { maxKeys: 3, size: "small" }),
  ),
})).value

// 有効なJSON値は常にバリデーション成功することを確認する
test("schema json value: accepts any valid json value", () => {
  fc.assert(
    fc.property(jsonValueArb, (value) => {
      const result = JsonValueSchema.safeParse(value)
      assert.isTrue(result.success)
    }),
  )
})

// ネストした配列やオブジェクトでもバリデーション成功することを確認する
test("schema json value: accepts nested arrays and objects", () => {
  const nestedArb = fc.letrec((tie) => ({
    value: fc.oneof(
      fc.string(),
      fc.integer(),
      fc.array(tie("value"), { minLength: 1, maxLength: 2, size: "small" }),
      fc.dictionary(fc.string(), tie("value"), { minKeys: 1, maxKeys: 2, size: "small" }),
    ),
  })).value

  fc.assert(
    fc.property(nestedArb, (value) => {
      const result = JsonValueSchema.safeParse(value)
      assert.isTrue(result.success)
    }),
  )
})

// --- Decoration関連 ---

const validDecorationNameArb = fc.stringMatching(/^[A-Za-z0-9_-]+$/)

// 有効な装飾名は常にバリデーション成功することを確認する
test("schema decoration: accepts valid names", () => {
  fc.assert(
    fc.property(validDecorationNameArb, (name) => {
      const result = DecorationSchema.safeParse({ name })
      assert.isTrue(result.success)
    }),
  )
})

// 空文字列の装飾名はバリデーション失敗することを確認する
test("schema decoration: rejects empty name", () => {
  const result = DecorationSchema.safeParse({ name: "" })
  assert.isFalse(result.success)
})

// 不正文字を含む装飾名はバリデーション失敗することを確認する
test("schema decoration: rejects names with invalid chars", () => {
  const invalidCharArb = fc.stringMatching(/^[A-Za-z0-9_-]*[^A-Za-z0-9_-]+[A-Za-z0-9_-]*$/)

  fc.assert(
    fc.property(invalidCharArb, (name) => {
      const result = DecorationSchema.safeParse({ name })
      assert.isFalse(result.success)
    }),
  )
})

// --- Token関連 ---

const tokenKindValues = [
  "LT",
  "LT_SLASH",
  "GT",
  "SLASH_GT",
  "IDENT",
  "DOT_IDENT",
  "EQUALS",
  "JSON_VALUE",
  "EOF",
] as const

// kindとpositionが正しいToken構造はバリデーション成功することを確認する
test("schema token: accepts valid token structure", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...tokenKindValues),
      fc.nat(),
      fc.string(),
      (kind, position, value) => {
        const result = TokenSchema.safeParse({ kind, position, value })
        assert.isTrue(result.success)
      },
    ),
  )
})

// positionが負数のTokenはバリデーション失敗することを確認する
test("schema token: rejects negative position", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...tokenKindValues),
      fc.integer({ max: -1 }),
      fc.string(),
      (kind, position, value) => {
        const result = TokenSchema.safeParse({ kind, position, value })
        assert.isFalse(result.success)
      },
    ),
  )
})

// 不正なkindのTokenはバリデーション失敗することを確認する
test("schema token: rejects invalid kind", () => {
  fc.assert(
    fc.property(
      fc.string().filter((s) => !(tokenKindValues as readonly string[]).includes(s)),
      fc.nat(),
      fc.string(),
      (kind, position, value) => {
        const result = TokenSchema.safeParse({ kind, position, value })
        assert.isFalse(result.success)
      },
    ),
  )
})

// --- ElementNode関連 ---

const tagNameArb = fc.stringMatching(/^[A-Za-z0-9_-]+$/)

// letrec 内の再帰と組み合わせてもスタックオーバーフローしないよう、
// 属性値はフラットなプリミティブのみにする
const flatJsonValueArb = fc.oneof(
  fc.string(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.boolean(),
  fc.constant(null),
)

const elementNodeArb: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  node: fc.record({
    type: fc.constant("element" as const),
    tagName: tagNameArb,
    decorations: fc.array(fc.record({ name: validDecorationNameArb }), { maxLength: 3 }),
    attributes: fc.dictionary(fc.string(), flatJsonValueArb, { maxKeys: 3 }),
    children: fc.array(tie("node"), { maxLength: 1, size: "small" }),
    selfClosing: fc.constant(false),
  }),
})).node

const selfClosingElementNodeArb = fc.record({
  type: fc.constant("element" as const),
  tagName: tagNameArb,
  decorations: fc.array(fc.record({ name: validDecorationNameArb }), { maxLength: 3 }),
  attributes: fc.dictionary(fc.string(), flatJsonValueArb, { maxKeys: 3 }),
  children: fc.constant([] as unknown[]),
  selfClosing: fc.constant(true),
})

// 有効なElementNodeはバリデーション成功することを確認する
test("schema element node: accepts valid element node", () => {
  fc.assert(
    fc.property(elementNodeArb, (node) => {
      const result = ElementNodeSchema.safeParse(node)
      assert.isTrue(result.success)
    }),
  )
})

// selfClosing=trueかつchildren空配列のElementNodeが成功することを確認する
test("schema element node: accepts self-closing node with empty children", () => {
  fc.assert(
    fc.property(selfClosingElementNodeArb, (node) => {
      const result = ElementNodeSchema.safeParse(node)
      assert.isTrue(result.success)
    }),
  )
})

// --- DocumentNode関連 ---

// 有効なDocumentNodeはバリデーション成功することを確認する
test("schema document node: accepts valid document node", () => {
  const documentNodeArb = fc.record({
    type: fc.constant("document" as const),
    children: fc.array(elementNodeArb, { maxLength: 2, size: "small" }),
  })

  fc.assert(
    fc.property(documentNodeArb, (doc) => {
      const result = DocumentNodeSchema.safeParse(doc)
      assert.isTrue(result.success)
    }),
  )
})

// --- NormalizedOptions関連 ---

// NormalizedOptionsSchema が有効な値を受理することを確認する
test("schema normalized feature options: accepts valid options", () => {
  fc.assert(
    fc.property(
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      (allowDecorations, allowAttributes, allowInject, allowLogic) => {
        const result = NormalizedOptionsSchema.safeParse({
          allowDecorations,
          allowAttributes,
          allowInject,
          allowLogic,
        })
        assert.isTrue(result.success)
      },
    ),
  )
})

// NormalizedOptionsSchema が不正な値を拒否することを確認する
test("schema normalized feature options: rejects non-boolean values", () => {
  const result = NormalizedOptionsSchema.safeParse({
    allowDecorations: "yes",
    allowAttributes: 1,
  })
  assert.isFalse(result.success)
})

// --- LogicArg関連 ---

// JSON値はLogicArgとして受理されることを確認する（LogicArgSchemaのlazy評価を起動する）
test("schema logic arg: accepts json value as logic arg", () => {
  const result = LogicArgSchema.safeParse("hello")
  assert.isTrue(result.success)
})

// InjectNodeはLogicArgとして受理されることを確認する
test("schema logic arg: accepts inject node as logic arg", () => {
  const result = LogicArgSchema.safeParse({ type: "inject", name: "mode" })
  assert.isTrue(result.success)
})

// LogicNodeはLogicArgとして受理されることを確認する
test("schema logic arg: accepts logic node as logic arg", () => {
  const result = LogicArgSchema.safeParse({ type: "logic", name: "equal", args: [1, "dark"] })
  assert.isTrue(result.success)
})
