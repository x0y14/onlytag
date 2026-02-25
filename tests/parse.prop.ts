import { test, assert } from "vitest"
import * as fc from "fast-check"
import { tokenize, parse, DocumentNodeSchema } from "../src/index.js"

function hasPositionHint(message: string): boolean {
  return /position|pos|index|offset/i.test(message)
}

const identArb = fc.stringMatching(/^[A-Za-z0-9_-]{1,10}$/)
const jsonLiteralArb = fc.jsonValue().map((value) => JSON.stringify(value))
const headerPartArb = fc.oneof(
  identArb.map((deco) => ({ text: `.${deco}` })),
  fc.tuple(identArb, jsonLiteralArb).map(([name, value]) => ({ text: `${name}=${value}` })),
)
const mixedHeaderPartArb = fc.oneof(
  identArb.map((name) => ({ kind: "deco" as const, name })),
  fc.tuple(identArb, fc.jsonValue()).map(([name, value]) => ({ kind: "attr" as const, name, value })),
)

const selfClosingElementArb = fc
  .record({
    tag: identArb,
    headerParts: fc.array(headerPartArb, { maxLength: 5 }),
  })
  .map(({ tag, headerParts }) => {
    const parts: string[] = [`<${tag}`]
    for (const part of headerParts) parts.push(part.text)
    return `${parts.join(" ")} />`
  })

const nestedElementArb = fc
  .record({
    tag: identArb,
    children: fc.array(selfClosingElementArb, { minLength: 1, maxLength: 3 }),
  })
  .map(({ tag, children }) => `<${tag}>${children.join("")}</${tag}>`)

const documentArb = fc
  .array(fc.oneof(selfClosingElementArb, nestedElementArb), {
    minLength: 1,
    maxLength: 3,
  })
  .map((elements) => elements.join(""))

// 有効文法の生成入力は DocumentNodeSchema を満たすことを確認する
test("parse property: generated valid grammar satisfies document schema", () => {
  fc.assert(
    fc.property(documentArb, (input) => {
      const doc = parse(tokenize(input))
      const result = DocumentNodeSchema.safeParse(doc)
      assert.isTrue(result.success)
    }),
    { numRuns: 200 },
  )
})

// ネスト要素の生成入力では子要素数が1以上になることを確認する
test("parse property: generated nested element has at least one child", () => {
  fc.assert(
    fc.property(nestedElementArb, (input) => {
      const doc = parse(tokenize(input))
      assert.equal(doc.children.length, 1)
      assert.isAtLeast(doc.children[0].children.length, 1)
    }),
    { numRuns: 200 },
  )
})

// 任意文字列入力は成功するか、位置情報付きエラーになることを確認する
test("parse property: arbitrary input succeeds or fails with position hint", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 160 }), (input) => {
      try {
        const doc = parse(tokenize(input))
        const result = DocumentNodeSchema.safeParse(doc)
        assert.isTrue(result.success)
      } catch (error) {
        assert.instanceOf(error, Error)
        assert.isTrue(hasPositionHint((error as Error).message))
      }
    }),
    { numRuns: 250 },
  )
})

// attr/decoが任意個・任意順で出現しても正しくパースできることを確認する
test("parse property: random attr and deco order is parsed correctly", () => {
  fc.assert(
    fc.property(
      fc.record({
        tag: identArb,
        parts: fc.array(mixedHeaderPartArb, { maxLength: 10 }),
      }),
      ({ tag, parts }) => {
        const input = `<${tag} ${parts
          .map((part) =>
            part.kind === "deco" ? `.${part.name}` : `${part.name}=${JSON.stringify(part.value)}`,
          )
          .join(" ")} />`
        const doc = parse(tokenize(input))
        assert.equal(doc.children.length, 1)
        assert.deepStrictEqual(
          doc.children[0].decorations.map((deco) => deco.name),
          parts.filter((part) => part.kind === "deco").map((part) => part.name),
        )
        const expectedAttributes: Record<string, unknown> = {}
        for (const part of parts) {
          if (part.kind === "attr") {
            expectedAttributes[part.name] = JSON.parse(JSON.stringify(part.value))
          }
        }
        assert.deepStrictEqual(doc.children[0].attributes, expectedAttributes)
      },
    ),
    { numRuns: 250 },
  )
})
