import { test, assert } from "vitest"
import { onlytag } from "../src/onlytag.js"
import { NAME_PATTERN, NAME_FIRST_CHAR_PATTERN, NAME_REST_CHAR_PATTERN } from "../src/naming.js"

const ot = new onlytag()

function assertControlledError(error: unknown): void {
  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /position|pos|index|offset/i)
}

// 長大な不正入力でも制御されたErrorで終了することを確認する
test("security: long malformed input fails with controlled error", () => {
  const input = `<A ${"x".repeat(20_000)}!=1 />`
  let error: unknown
  try {
    ot.parse(ot.tokenize(input))
  } catch (caught) {
    error = caught
  }
  if (error === undefined) {
    assert.fail("missing security error: expected=<Error>, actual=<no-throw>")
  }
  assertControlledError(error)
})

// 深いネスト入力でもハングしないことを確認する
test("security: deep nesting does not hang", () => {
  const depth = 250
  const open = Array.from({ length: depth }, () => "<A>").join("")
  const close = Array.from({ length: depth }, () => "</A>").join("")
  const input = `${open}<Leaf />${close}`

  const startedAt = Date.now()
  try {
    const doc = ot.parse(ot.tokenize(input))
    assert.equal(doc.children.length, 1)
  } catch (error) {
    assertControlledError(error)
  }
  const elapsed = Date.now() - startedAt
  assert.isBelow(elapsed, 2000)
})

// JSON属性に__proto__を含めてもprototype pollutionが起きないことを確認する
test("security: __proto__ payload does not cause prototype pollution", () => {
  assert.isUndefined(({} as { polluted?: string }).polluted)

  const doc = ot.parse(ot.tokenize('<A payload={"__proto__":{"polluted":"yes"},"safe":1} />'))
  const payload = doc.children[0].attributes["payload"]
  assert.deepStrictEqual(payload, { safe: 1 })
  // __proto__ が own property として存在しないことを明示的に検証する
  assert.isFalse(Object.prototype.hasOwnProperty.call(payload, "__proto__"))
  assert.isUndefined(({} as { polluted?: string }).polluted)
})

// HTML風のペイロードは単なる文字列として扱われることを確認する
test("security: html-like payload is treated as plain string", () => {
  const doc = ot.parse(ot.tokenize('<A content="</script><img src=x onerror=alert(1)>" />'))
  assert.equal(doc.children[0].attributes["content"], "</script><img src=x onerror=alert(1)>")
})

// デフォルトのmaxNestingDepthを超えるネスト入力でposition付きのエラーが発生することを確認する
test("security: excessive nesting depth produces controlled error", () => {
  const depth = 2000
  const open = Array.from({ length: depth }, () => "<A>").join("")
  const close = Array.from({ length: depth }, () => "</A>").join("")
  const input = `${open}<Leaf />${close}`

  let error: unknown
  try {
    ot.parse(ot.tokenize(input))
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing security error: expected=<Error>, actual=<no-throw>")
  }
  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /nesting depth/)
  assert.match((error as Error).message, /position=/)
})

// --- マルチバイト文字テスト ---

// タグ名に日本語が含まれるとtokenize段でエラーになることを確認する
test("security: Japanese tag name is rejected", () => {
  assert.throws(
    () => ot.tokenize("<日本語 />"),
    /position=/,
  )
})

// 属性名に絵文字が含まれるとtokenize段でエラーになることを確認する
test("security: emoji attribute name is rejected", () => {
  assert.throws(
    () => ot.tokenize('<A 🔥=1 />'),
    /position=/,
  )
})

// デコレーション名にゼロ幅スペースが含まれるとtokenize段でエラーになることを確認する
test("security: zero-width space in decoration name is rejected", () => {
  assert.throws(
    () => ot.tokenize("<A .\u200Bhidden />"),
    /position=/,
  )
})

// --- ReDoS テスト ---

// NAME_PATTERNに対するバックトラッキング誘発入力が高速に処理されることを確認する
test("security: NAME_PATTERN resists ReDoS with long input", () => {
  const malicious = "a" + "-".repeat(100_000) + "!"
  const startedAt = Date.now()
  const result = NAME_PATTERN.test(malicious)
  const elapsed = Date.now() - startedAt

  assert.isFalse(result)
  assert.isBelow(elapsed, 100)
})

// NAME_FIRST_CHAR_PATTERNに対するバックトラッキング誘発入力が高速に処理されることを確認する
test("security: NAME_FIRST_CHAR_PATTERN resists ReDoS", () => {
  const malicious = "a".repeat(100_000)
  const startedAt = Date.now()
  const result = NAME_FIRST_CHAR_PATTERN.test(malicious)
  const elapsed = Date.now() - startedAt

  assert.isFalse(result)
  assert.isBelow(elapsed, 100)
})

// NAME_REST_CHAR_PATTERNに対するバックトラッキング誘発入力が高速に処理されることを確認する
test("security: NAME_REST_CHAR_PATTERN resists ReDoS", () => {
  const malicious = "a".repeat(100_000)
  const startedAt = Date.now()
  const result = NAME_REST_CHAR_PATTERN.test(malicious)
  const elapsed = Date.now() - startedAt

  assert.isFalse(result)
  assert.isBelow(elapsed, 100)
})
