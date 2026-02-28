import { test, assert } from "vitest"
import * as fc from "fast-check"
import {
  JsonValueSchema,
  DecorationSchema,
  PlaceholderSchema,
  GroupValueSchema,
  AttributeValueSchema,
  ElementNodeSchema,
  DocumentNodeSchema,
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

const validDecorationNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/)

// 有効な装飾名は常にバリデーション成功することを確認する
test("schema decoration: accepts valid names", () => {
  fc.assert(
    fc.property(validDecorationNameArb, (name) => {
      const result = DecorationSchema.safeParse(name)
      assert.isTrue(result.success)
    }),
  )
})

// 空文字列の装飾名はバリデーション失敗することを確認する
test("schema decoration: rejects empty name", () => {
  const result = DecorationSchema.safeParse("")
  assert.isFalse(result.success)
})

// 不正文字を含む装飾名はバリデーション失敗することを確認する
test("schema decoration: rejects names with invalid chars", () => {
  const invalidCharArb = fc.stringMatching(/^[A-Za-z0-9_-]*[^A-Za-z0-9_-]+[A-Za-z0-9_-]*$/)

  fc.assert(
    fc.property(invalidCharArb, (name) => {
      const result = DecorationSchema.safeParse(name)
      assert.isFalse(result.success)
    }),
  )
})

// --- 属性キー関連 ---

const validAttributeKeyArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/)

// --- Placeholder関連 ---

const validPlaceholderNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
const invalidPlaceholderNameArb = fc.oneof(
  fc.constant(""),
  fc.stringMatching(/^[0-9][a-zA-Z0-9_-]*$/),
  fc.stringMatching(/^_[a-zA-Z0-9_-]*$/),
  fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*[^a-zA-Z0-9_-]+[a-zA-Z0-9_-]*$/),
)

// 有効な placeholder 名は常にバリデーション成功することを確認する
test("schema placeholder: accepts valid placeholder names", () => {
  fc.assert(
    fc.property(validPlaceholderNameArb, (name) => {
      const result = PlaceholderSchema.safeParse({ type: "placeholder", name })
      assert.isTrue(result.success)
    }),
  )
})

// 不正な placeholder 名はバリデーション失敗することを確認する
test("schema placeholder: rejects invalid placeholder names", () => {
  fc.assert(
    fc.property(invalidPlaceholderNameArb, (name) => {
      const result = PlaceholderSchema.safeParse({ type: "placeholder", name })
      assert.isFalse(result.success)
    }),
  )
})

// --- GroupValue関連 ---

const groupValueArb = fc.record({
  type: fc.constant("group" as const),
  values: fc.array(
    fc.oneof(
      validPlaceholderNameArb.map((name) => ({ type: "placeholder" as const, name })),
      fc.string(),
      fc.double({ noNaN: true, noDefaultInfinity: true }),
      fc.integer(),
      fc.boolean(),
      fc.constant(null),
    ),
    { maxLength: 5 },
  ),
})

// 有効な GroupValue は常にバリデーション成功することを確認する
test("schema group value: accepts valid group values", () => {
  fc.assert(
    fc.property(groupValueArb, (groupValue) => {
      const result = GroupValueSchema.safeParse(groupValue)
      assert.isTrue(result.success)
    }),
  )
})

// GroupValue の type が "group" でない場合はバリデーション失敗することを確認する
test("schema group value: rejects invalid type", () => {
  const result = GroupValueSchema.safeParse({ type: "invalid", values: [] })
  assert.isFalse(result.success)
})

// GroupValue の values が配列でない場合はバリデーション失敗することを確認する
test("schema group value: rejects non-array values", () => {
  const result = GroupValueSchema.safeParse({ type: "group", values: "not-array" })
  assert.isFalse(result.success)
})

// AttributeValueSchema が GroupValue を受理することを確認する
test("schema attribute value: accepts group value", () => {
  fc.assert(
    fc.property(groupValueArb, (groupValue) => {
      const result = AttributeValueSchema.safeParse(groupValue)
      assert.isTrue(result.success)
    }),
  )
})

// AttributeValueSchema が JSON 値を受理することを確認する
test("schema attribute value: accepts json values", () => {
  fc.assert(
    fc.property(fc.jsonValue(), (value) => {
      const result = AttributeValueSchema.safeParse(value)
      assert.isTrue(result.success)
    }),
  )
})

// AttributeValueSchema が placeholder を受理することを確認する
test("schema attribute value: accepts placeholder", () => {
  fc.assert(
    fc.property(validPlaceholderNameArb, (name) => {
      const result = AttributeValueSchema.safeParse({ type: "placeholder", name })
      assert.isTrue(result.success)
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
  "PLACEHOLDER",
  "LPAREN",
  "RPAREN",
  "COMMA",
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

// pairIndex 付きの Token もバリデーション成功することを確認する
test("schema token: accepts token with pairIndex", () => {
  const delimiterKindValues = ["LT", "LT_SLASH", "GT", "SLASH_GT"] as const
  fc.assert(
    fc.property(
      fc.constantFrom(...delimiterKindValues),
      fc.nat(),
      fc.string(),
      fc.nat(),
      (kind, position, value, pairIndex) => {
        const result = TokenSchema.safeParse({ kind, position, value, pairIndex })
        assert.isTrue(result.success)
      },
    ),
  )
})

// pairIndex が負数の Token はバリデーション失敗することを確認する
test("schema token: rejects negative pairIndex", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("LT" as const, "GT" as const),
      fc.nat(),
      fc.string(),
      fc.integer({ max: -1 }),
      (kind, position, value, pairIndex) => {
        const result = TokenSchema.safeParse({ kind, position, value, pairIndex })
        assert.isFalse(result.success)
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

const tagNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]*$/)

// letrec 内の再帰と組み合わせてもスタックオーバーフローしないよう、
// 属性値はフラットなプリミティブ、placeholder、またはグループ値にする
const flatAttributeValueArb = fc.oneof(
  fc.string(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.boolean(),
  fc.constant(null),
  validPlaceholderNameArb.map((name) => ({ type: "placeholder" as const, name })),
  fc
    .array(
      fc.oneof(
        fc.string(),
        fc.integer(),
        fc.boolean(),
        fc.constant(null),
        validPlaceholderNameArb.map((name) => ({ type: "placeholder" as const, name })),
      ),
      { maxLength: 3 },
    )
    .map((values) => ({ type: "group" as const, values })),
)

const elementNodeArb: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  node: fc.record({
    type: fc.constant("element" as const),
    name: tagNameArb,
    decorations: fc.uniqueArray(validDecorationNameArb, { maxLength: 3 }),
    attributes: fc.dictionary(validAttributeKeyArb, flatAttributeValueArb, { maxKeys: 3 }),
    children: fc.array(tie("node"), { maxLength: 1, size: "small" }),
    selfClosing: fc.constant(false),
  }),
})).node

const selfClosingElementNodeArb = fc.record({
  type: fc.constant("element" as const),
  name: tagNameArb,
  decorations: fc.uniqueArray(validDecorationNameArb, { maxLength: 3 }),
  attributes: fc.dictionary(validAttributeKeyArb, flatAttributeValueArb, { maxKeys: 3 }),
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

import { ALLOWED_DELIMITER_CHARS } from "../src/types.js"

const allowedCharsArray = [...ALLOWED_DELIMITER_CHARS]

// validateTags 互換の arbitrary: 異なるペア間で文字が重複しない tags を生成
const validTagsArb = fc
  .shuffledSubarray(allowedCharsArray, { minLength: 2, maxLength: 6 })
  .map((chars) => {
    const pairs: { opening: string; closing: string }[] = []
    for (let index = 0; index + 1 < chars.length; index += 2) {
      pairs.push({ opening: chars[index], closing: chars[index + 1] })
    }
    return pairs
  })
  .filter((pairs) => pairs.length >= 1)

// NormalizedOptionsSchema が有効な値を受理することを確認する
test("schema normalized feature options: accepts valid options", () => {
  fc.assert(
    fc.property(
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      fc.boolean(),
      validTagsArb,
      (
        allowDecorations,
        allowAttributes,
        allowPlaceholders,
        allowGroup,
        allowMixedDelimiters,
        allowInconsistentClosures,
        tags,
      ) => {
        const result = NormalizedOptionsSchema.safeParse({
          allowDecorations,
          allowAttributes,
          allowPlaceholders,
          allowGroup,
          allowMixedDelimiters,
          allowInconsistentClosures,
          tags,
          maxNestingDepth: 1024,
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
    allowPlaceholders: "no",
    allowGroup: true,
    allowMixedDelimiters: true,
    allowInconsistentClosures: true,
    maxNestingDepth: 1024,
    tags: [{ opening: "<", closing: ">" }],
  })
  assert.isFalse(result.success)
})

// tags が空配列の場合は NormalizedOptionsSchema で拒否されることを確認する
test("schema normalized feature options: rejects empty tags array", () => {
  const result = NormalizedOptionsSchema.safeParse({
    allowDecorations: true,
    allowAttributes: true,
    allowPlaceholders: true,
    allowGroup: true,
    allowMixedDelimiters: true,
    allowInconsistentClosures: true,
    maxNestingDepth: 1024,
    tags: [],
  })
  assert.isFalse(result.success)
})

// 許可文字外の opening を含む tags は NormalizedOptionsSchema で拒否されることを確認する
test("schema normalized feature options: rejects tags with disallowed characters", () => {
  const result = NormalizedOptionsSchema.safeParse({
    allowDecorations: true,
    allowAttributes: true,
    allowPlaceholders: true,
    allowGroup: true,
    allowMixedDelimiters: true,
    allowInconsistentClosures: true,
    maxNestingDepth: 1024,
    tags: [{ opening: "a", closing: ">" }],
  })
  assert.isFalse(result.success)
})

// 異なるペア間で重複する文字を含む tags は NormalizedOptionsSchema で拒否されることを確認する
test("schema normalized feature options: rejects tags with duplicate characters across pairs", () => {
  const result = NormalizedOptionsSchema.safeParse({
    allowDecorations: true,
    allowAttributes: true,
    allowPlaceholders: true,
    allowGroup: true,
    allowMixedDelimiters: true,
    allowInconsistentClosures: true,
    maxNestingDepth: 1024,
    tags: [
      { opening: "<", closing: ">" },
      { opening: "<", closing: "!" },
    ],
  })
  assert.isFalse(result.success)
})

// tags が欠落している場合は NormalizedOptionsSchema で拒否されることを確認する
test("schema normalized feature options: rejects missing tags", () => {
  const result = NormalizedOptionsSchema.safeParse({
    allowDecorations: true,
    allowAttributes: true,
    allowPlaceholders: true,
    allowGroup: true,
    allowMixedDelimiters: true,
    allowInconsistentClosures: true,
    maxNestingDepth: 1024,
  })
  assert.isFalse(result.success)
})
