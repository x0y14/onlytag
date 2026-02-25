import { test, assert } from "vitest"
import fc from "fast-check"
import { onlytag } from "../src/onlytag.js"

/** options の arbitrary */
const optionsArb = fc.record({
  allowDecorations: fc.boolean(),
  allowAttributes: fc.boolean(),
})

/** 有効な識別子 */
const identArb = fc.stringMatching(/^[A-Za-z][A-Za-z0-9_-]{0,9}$/)

/** decoration 文字列 */
const decorationArb = identArb.map((name) => `.${name}`)

/** JSON リテラル */
const jsonLiteralArb = fc.jsonValue().map((value) => JSON.stringify(value))

/** attribute 文字列 */
const attributeArb = fc.tuple(identArb, jsonLiteralArb).map(([key, value]) => `${key}=${value}`)

/** カテゴリ A: タグのみ */
const tagOnlyInputArb = identArb.map((tag) => `<${tag} />`)

/** カテゴリ B: decoration のみ */
const decoOnlyInputArb = fc
  .tuple(identArb, fc.array(decorationArb, { minLength: 1, maxLength: 3 }))
  .map(([tag, decos]) => `<${tag} ${decos.join(" ")} />`)

/** カテゴリ C: attribute のみ */
const attrOnlyInputArb = fc
  .tuple(identArb, fc.array(attributeArb, { minLength: 1, maxLength: 3 }))
  .map(([tag, attrs]) => `<${tag} ${attrs.join(" ")} />`)

/** カテゴリ D: 両方 */
const bothInputArb = fc
  .tuple(
    identArb,
    fc.array(decorationArb, { minLength: 1, maxLength: 2 }),
    fc.array(attributeArb, { minLength: 1, maxLength: 2 }),
  )
  .map(([tag, decos, attrs]) => `<${tag} ${decos.join(" ")} ${attrs.join(" ")} />`)

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
