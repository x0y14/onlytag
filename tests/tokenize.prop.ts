import { test, assert } from "vitest"
import * as fc from "fast-check"
import { onlytag } from "../src/onlytag.js"

const ot = new onlytag()

function hasPositionHint(message: string): boolean {
  return /position|pos|index|offset/i.test(message)
}

function expectTokenizerErrorWithPosition(input: string): void {
  let error: unknown
  try {
    ot.tokenize(input)
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing tokenizer error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.isTrue(hasPositionHint((error as Error).message))
}

const identArb = fc.stringMatching(/^[A-Za-z0-9_-]{1,10}$/)
const jsonLiteralArb = fc.jsonValue().map((value) => JSON.stringify(value))
const invalidJsonLiteralArb = fc.oneof(
  fc.constantFrom("", "-", "tru", "fals", "nul", '"unterminated', "{", "[", "1e", "01"),
  fc.jsonValue().map((value) => `${JSON.stringify(value)}x`),
)

const selfClosingTagInputArb = fc
  .record({
    tag: identArb,
    decorations: fc.array(identArb, { maxLength: 2 }),
    attributes: fc.array(fc.tuple(identArb, jsonLiteralArb), { maxLength: 3 }),
  })
  .map(({ tag, decorations, attributes }) => {
    const parts: string[] = [`<${tag}`]
    for (const deco of decorations) parts.push(`.${deco}`)
    for (const [name, value] of attributes) parts.push(`${name}=${value}`)
    return `${parts.join(" ")} />`
  })

// 任意文字列入力が成功か位置情報付きエラーになることを確認する
test("tokenize property: arbitrary input succeeds or fails with position hint", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 120 }), (input) => {
      try {
        const tokens = ot.tokenize(input)
        assert.isArray(tokens)
        assert.isAtLeast(tokens.length, 1)
        assert.equal(tokens[tokens.length - 1].kind, "EOF")
      } catch (error) {
        assert.instanceOf(error, Error)
        assert.isTrue(hasPositionHint((error as Error).message))
      }
    }),
    { numRuns: 300 },
  )
})

// 有効な自己閉じタグ生成入力は必ずEOFで終わることを確認する
test("tokenize property: generated self-closing tags always end with eof", () => {
  fc.assert(
    fc.property(selfClosingTagInputArb, (input) => {
      const tokens = ot.tokenize(input)
      assert.equal(tokens[0].kind, "LT")
      assert.equal(tokens[tokens.length - 1].kind, "EOF")
      assert.equal(tokens.find((token) => token.kind === "IDENT")?.value.length! > 0, true)
    }),
    { numRuns: 200 },
  )
})

// 空白差分がトークン列のkind/valueを変えないことを確認する
test("tokenize property: whitespace variation preserves token kinds and values", () => {
  fc.assert(
    fc.property(identArb, identArb, fc.integer({ min: -9, max: 9 }), (tag, attr, value) => {
      const compact = `<${tag} ${attr}=${value} />`
      const spaced = `<  ${tag}   ${attr} = ${value}   />`
      const compactTokens = ot.tokenize(compact)
      const spacedTokens = ot.tokenize(spaced)
      assert.deepStrictEqual(
        compactTokens.map((token) => token.kind),
        spacedTokens.map((token) => token.kind),
      )
      assert.deepStrictEqual(
        compactTokens.map((token) => token.value),
        spacedTokens.map((token) => token.value),
      )
    }),
    { numRuns: 200 },
  )
})

// 境界値を含む不正JSON属性値は失敗することを確認する
test("tokenize property: invalid json attribute values are always rejected", () => {
  fc.assert(
    fc.property(invalidJsonLiteralArb, fc.constantFrom("/>", " />", "   />"), (value, close) => {
      expectTokenizerErrorWithPosition(`<A attr=${value}${close}`)
    }),
    { numRuns: 250 },
  )
})

// 不正なデコレーションを含むタグは失敗することを確認する
test("tokenize property: invalid decorations are rejected", () => {
  fc.assert(
    fc.property(identArb, fc.constantFrom("", "!", "@", ":", ",", " "), (tag, suffix) => {
      expectTokenizerErrorWithPosition(`<${tag} .${suffix} />`)
    }),
    { numRuns: 200 },
  )
})

// 不正な属性名を含むタグは失敗することを確認する
test("tokenize property: invalid attributes are rejected", () => {
  fc.assert(
    fc.property(identArb, fc.constantFrom("!", "@", ":", ","), (tag, badChar) => {
      expectTokenizerErrorWithPosition(`<${tag} attr${badChar}=1 />`)
    }),
    { numRuns: 200 },
  )
})

// 有効な placeholder 属性を含むタグは PLACEHOLDER トークンを生成することを確認する
test("tokenize property: valid placeholder attribute produces PLACEHOLDER token", () => {
  const placeholderNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9-]{0,9}$/)
  fc.assert(
    fc.property(identArb, identArb, placeholderNameArb, (tag, attrName, phName) => {
      const input = `<${tag} ${attrName}=$${phName} />`
      const tokens = ot.tokenize(input)
      const ph = tokens.find((t) => t.kind === "PLACEHOLDER")
      assert.isDefined(ph)
      assert.equal(ph!.value, `$${phName}`)
    }),
    { numRuns: 200 },
  )
})
