import { test, assert } from "vitest"
import fc from "fast-check"
import { onlytag } from "../src/onlytag.js"

/** options の arbitrary */
const optionsArb = fc.record({
  allowDecorations: fc.boolean(),
  allowAttributes: fc.boolean(),
  allowPlaceholders: fc.boolean(),
})

/** 有効な識別子 */
const identArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{0,9}$/)

/** 有効なタグ名（[a-zA-Z][a-zA-Z0-9_-]*） */
const tagNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,9}$/)

/** decoration 文字列 */
const decorationArb = identArb.map((name) => `.${name}`)

/** JSON リテラル */
const jsonLiteralArb = fc.jsonValue().map((value) => JSON.stringify(value))

/** attribute 文字列 */
const attributeArb = fc.tuple(identArb, jsonLiteralArb).map(([key, value]) => `${key}=${value}`)

/** placeholder 名 */
const placeholderNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9_-]{0,9}$/)

/** placeholder 属性文字列 */
const placeholderAttributeArb = fc
  .tuple(identArb, placeholderNameArb)
  .map(([key, name]) => `${key}=$${name}`)

/** グループ値の要素 */
const groupValueItemArb = fc.oneof(
  jsonLiteralArb,
  placeholderNameArb.map((name) => `$${name}`),
)

/** グループ属性文字列（必ず placeholder を含む） */
const groupWithPlaceholderAttributeArb = fc
  .tuple(
    identArb,
    placeholderNameArb.map((name) => `$${name}`),
    fc.array(groupValueItemArb, { minLength: 0, maxLength: 2 }),
  )
  .map(([key, placeholder, otherItems]) => `${key}=(${[placeholder, ...otherItems].join(", ")})`)

/** グループ属性文字列（JSON のみ） */
const groupJsonOnlyAttributeArb = fc
  .tuple(identArb, fc.array(jsonLiteralArb, { minLength: 0, maxLength: 3 }))
  .map(([key, items]) => `${key}=(${items.join(", ")})`)

/** カテゴリ A: タグのみ */
const tagOnlyInputArb = tagNameArb.map((tag) => `<${tag} />`)

/** カテゴリ B: decoration のみ */
const decoOnlyInputArb = fc
  .tuple(tagNameArb, fc.array(decorationArb, { minLength: 1, maxLength: 3 }))
  .map(([tag, decos]) => `<${tag} ${decos.join(" ")} />`)

/**
 * 属性文字列配列から属性名の重複を除去する。
 * 属性文字列は "key=value" 形式を想定する
 */
function deduplicateAttrs(attrs: string[]): string[] {
  const seen = new Set<string>()
  return attrs.filter((attr) => {
    const key = attr.slice(0, attr.indexOf("="))
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** カテゴリ C: attribute のみ */
const attrOnlyInputArb = fc
  .tuple(tagNameArb, fc.array(attributeArb, { minLength: 1, maxLength: 3 }))
  .filter(([, attrs]) => deduplicateAttrs(attrs).length >= 1)
  .map(([tag, attrs]) => `<${tag} ${deduplicateAttrs(attrs).join(" ")} />`)

/** カテゴリ D: 両方 */
const bothInputArb = fc
  .tuple(
    tagNameArb,
    fc.array(decorationArb, { minLength: 1, maxLength: 2 }),
    fc.array(attributeArb, { minLength: 1, maxLength: 2 }),
  )
  .filter(([, , attrs]) => deduplicateAttrs(attrs).length >= 1)
  .map(([tag, decos, attrs]) => `<${tag} ${decos.join(" ")} ${deduplicateAttrs(attrs).join(" ")} />`)

/** カテゴリ E: placeholder のみ */
const placeholderOnlyInputArb = fc
  .tuple(tagNameArb, fc.array(placeholderAttributeArb, { minLength: 1, maxLength: 3 }))
  .filter(([, attrs]) => deduplicateAttrs(attrs).length >= 1)
  .map(([tag, attrs]) => `<${tag} ${deduplicateAttrs(attrs).join(" ")} />`)

// カテゴリ A はどのモードでも成功することを確認する
test("options property: カテゴリ A はどのモードでも成功する", () => {
  fc.assert(
    fc.property(optionsArb, tagOnlyInputArb, (options, input) => {
      const ot = new onlytag(options)
      const tokens = ot.tokenize(input)
      const document = ot.parse(tokens)
      assert.strictEqual(document.type, "document")
    }),
  )
})

// カテゴリ B は allowDecorations=true でのみ成功することを確認する
test("options property: カテゴリ B は allowDecorations=true でのみ成功する", () => {
  fc.assert(
    fc.property(optionsArb, decoOnlyInputArb, (options, input) => {
      const ot = new onlytag(options)
      if (options.allowDecorations) {
        const tokens = ot.tokenize(input)
        const document = ot.parse(tokens)
        assert.strictEqual(document.type, "document")
      } else {
        assert.throws(() => {
          const tokens = ot.tokenize(input)
          ot.parse(tokens)
        })
      }
    }),
  )
})

// カテゴリ C は allowAttributes=true でのみ成功することを確認する
test("options property: カテゴリ C は allowAttributes=true でのみ成功する", () => {
  fc.assert(
    fc.property(optionsArb, attrOnlyInputArb, (options, input) => {
      const ot = new onlytag(options)
      if (options.allowAttributes) {
        const tokens = ot.tokenize(input)
        const document = ot.parse(tokens)
        assert.strictEqual(document.type, "document")
      } else {
        assert.throws(() => {
          const tokens = ot.tokenize(input)
          ot.parse(tokens)
        })
      }
    }),
  )
})

// カテゴリ D は両方 true でのみ成功することを確認する
test("options property: カテゴリ D は両方 true でのみ成功する", () => {
  fc.assert(
    fc.property(optionsArb, bothInputArb, (options, input) => {
      const ot = new onlytag(options)
      if (options.allowDecorations && options.allowAttributes) {
        const tokens = ot.tokenize(input)
        const document = ot.parse(tokens)
        assert.strictEqual(document.type, "document")
      } else {
        assert.throws(() => {
          const tokens = ot.tokenize(input)
          ot.parse(tokens)
        })
      }
    }),
  )
})

// カテゴリ E は allowAttributes=true かつ allowPlaceholders=true でのみ成功することを確認する
test("options property: カテゴリ E は allowAttributes=true かつ allowPlaceholders=true でのみ成功する", () => {
  fc.assert(
    fc.property(optionsArb, placeholderOnlyInputArb, (options, input) => {
      const ot = new onlytag(options)
      if (options.allowAttributes && options.allowPlaceholders) {
        const tokens = ot.tokenize(input)
        const document = ot.parse(tokens)
        assert.strictEqual(document.type, "document")
      } else {
        assert.throws(() => {
          const tokens = ot.tokenize(input)
          ot.parse(tokens)
        })
      }
    }),
  )
})

// カテゴリ F: グループ値（placeholder を含む）は allowAttributes=true かつ allowPlaceholders=true でのみ成功する

/** カテゴリ F: グループ値（placeholder を含む） */
const groupWithPlaceholderInputArb = fc
  .tuple(tagNameArb, fc.array(groupWithPlaceholderAttributeArb, { minLength: 1, maxLength: 2 }))
  .filter(([, attrs]) => deduplicateAttrs(attrs).length >= 1)
  .map(([tag, attrs]) => `<${tag} ${deduplicateAttrs(attrs).join(" ")} />`)

test("options property: カテゴリ F（グループ値 + placeholder）は allowAttributes=true かつ allowPlaceholders=true でのみ成功する", () => {
  fc.assert(
    fc.property(optionsArb, groupWithPlaceholderInputArb, (options, input) => {
      const ot = new onlytag(options)
      if (options.allowAttributes && options.allowPlaceholders) {
        const tokens = ot.tokenize(input)
        const document = ot.parse(tokens)
        assert.strictEqual(document.type, "document")
      } else {
        assert.throws(() => {
          const tokens = ot.tokenize(input)
          ot.parse(tokens)
        })
      }
    }),
  )
})

// カテゴリ G: グループ値（JSON のみ）は allowAttributes=true でのみ成功する

/** カテゴリ G: グループ値（JSON のみ） */
const groupJsonOnlyInputArb = fc
  .tuple(tagNameArb, fc.array(groupJsonOnlyAttributeArb, { minLength: 1, maxLength: 2 }))
  .filter(([, attrs]) => deduplicateAttrs(attrs).length >= 1)
  .map(([tag, attrs]) => `<${tag} ${deduplicateAttrs(attrs).join(" ")} />`)

test("options property: カテゴリ G（グループ値 JSON のみ）は allowAttributes=true でのみ成功する", () => {
  fc.assert(
    fc.property(optionsArb, groupJsonOnlyInputArb, (options, input) => {
      const ot = new onlytag(options)
      if (options.allowAttributes) {
        const tokens = ot.tokenize(input)
        const document = ot.parse(tokens)
        assert.strictEqual(document.type, "document")
      } else {
        assert.throws(() => {
          const tokens = ot.tokenize(input)
          ot.parse(tokens)
        })
      }
    }),
  )
})
