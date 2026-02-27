import { test, assert } from "vitest"
import * as fc from "fast-check"
import { onlytag, DocumentNodeSchema } from "../src/index.js"

const ot = new onlytag()

function hasPositionHint(message: string): boolean {
  return /position|pos|index|offset/i.test(message)
}

const identArb = fc.stringMatching(/^[A-Za-z0-9_-]{1,10}$/)
const tagNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9-]{0,9}$/)
const safeIdentArb = identArb.filter((value) => value !== "__proto__")
const jsonLiteralArb = fc.jsonValue().map((value) => JSON.stringify(value))
const placeholderNameArb = fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9-]{0,9}$/)
function hasProtoKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => hasProtoKey(item))
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (Object.prototype.hasOwnProperty.call(record, "__proto__")) return true
    return Object.values(record).some((item) => hasProtoKey(item))
  }
  return false
}
const safeJsonValueArb = fc.jsonValue().filter((value) => !hasProtoKey(value))
/** グループ値リテラルの arbitrary */
const groupValueItemArb = fc.oneof(
  jsonLiteralArb,
  placeholderNameArb.map((name) => `$${name}`),
)
const groupValueLiteralArb = fc
  .array(groupValueItemArb, { minLength: 0, maxLength: 3 })
  .map((items) => `(${items.join(", ")})`)

const headerPartArb = fc.oneof(
  identArb.map((deco) => ({ text: `.${deco}` })),
  fc.tuple(identArb, jsonLiteralArb).map(([name, value]) => ({ text: `${name}=${value}` })),
  fc.tuple(identArb, placeholderNameArb).map(([name, phName]) => ({ text: `${name}=$${phName}` })),
  fc.tuple(identArb, groupValueLiteralArb).map(([name, value]) => ({ text: `${name}=${value}` })),
)
/** グループ値の要素で使用禁止な type プロパティを持つかどうかを判定する */
function hasReservedType(value: unknown): boolean {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    return record["type"] === "placeholder" || record["type"] === "group"
  }
  return false
}
/** グループ値の要素 arbitrary（解析結果比較用） */
const groupValueElementArb = fc.oneof(
  safeJsonValueArb.filter((value) => !hasReservedType(value)),
  placeholderNameArb.map((name) => ({ type: "placeholder" as const, name })),
)

const mixedHeaderPartArb = fc.oneof(
  safeIdentArb.map((name) => ({ kind: "deco" as const, name })),
  fc.tuple(safeIdentArb, safeJsonValueArb).map(([name, value]) => ({
    kind: "attr" as const,
    name,
    value,
  })),
  fc.tuple(safeIdentArb, placeholderNameArb).map(([name, phName]) => ({
    kind: "placeholder" as const,
    name,
    phName,
  })),
  fc.tuple(safeIdentArb, fc.array(groupValueElementArb, { minLength: 0, maxLength: 3 })).map(([name, values]) => ({
    kind: "group" as const,
    name,
    values,
  })),
)

const selfClosingElementArb = fc
  .record({
    tag: tagNameArb,
    headerParts: fc.array(headerPartArb, { maxLength: 5 }),
  })
  .map(({ tag, headerParts }) => {
    const parts: string[] = [`<${tag}`]
    for (const part of headerParts) parts.push(part.text)
    return `${parts.join(" ")} />`
  })

const nestedElementArb = fc
  .record({
    tag: tagNameArb,
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
      const doc = ot.parse(ot.tokenize(input))
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
      const doc = ot.parse(ot.tokenize(input))
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
        const doc = ot.parse(ot.tokenize(input))
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

// attr/deco/placeholderが任意個・任意順で出現しても正しくパースできることを確認する
test("parse property: random attr and deco order is parsed correctly", () => {
  fc.assert(
    fc.property(
      fc.record({
        tag: tagNameArb,
        parts: fc.array(mixedHeaderPartArb, { maxLength: 10 }),
      }),
      ({ tag, parts }) => {
        const input = `<${tag} ${parts
          .map((part) => {
            if (part.kind === "deco") return `.${part.name}`
            if (part.kind === "placeholder") return `${part.name}=$${part.phName}`
            if (part.kind === "group") {
              const items = part.values.map((v: unknown) => {
                if (v && typeof v === "object" && (v as any).type === "placeholder") {
                  return `$${(v as any).name}`
                }
                return JSON.stringify(v)
              })
              return `${part.name}=(${items.join(", ")})`
            }
            return `${part.name}=${JSON.stringify(part.value)}`
          })
          .join(" ")} />`
        const doc = ot.parse(ot.tokenize(input))
        assert.equal(doc.children.length, 1)
        assert.deepStrictEqual(
          doc.children[0].decorations.map((deco) => deco.name),
          parts.filter((part) => part.kind === "deco").map((part) => part.name),
        )
        const expectedAttributes: Record<string, unknown> = {}
        for (const part of parts) {
          if (part.kind === "attr") {
            expectedAttributes[part.name] = JSON.parse(JSON.stringify(part.value))
          } else if (part.kind === "placeholder") {
            expectedAttributes[part.name] = { type: "placeholder", name: part.phName }
          } else if (part.kind === "group") {
            expectedAttributes[part.name] = {
              type: "group",
              values: part.values.map((v: unknown) => JSON.parse(JSON.stringify(v))),
            }
          }
        }
        assert.deepStrictEqual(doc.children[0].attributes, expectedAttributes)
      },
    ),
    { numRuns: 250 },
  )
})
