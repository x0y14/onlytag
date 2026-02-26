import { test, assert } from "vitest"
import { normalizeOptions } from "../src/types.js"

const defaultTags = [{ opening: "<", closing: ">" }]

// undefined はデフォルト値を返すことを確認する
test("normalizeOptions: undefined はデフォルト値を返す", () => {
  const result = normalizeOptions(undefined)
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: true,
    allowPlaceholders: true,
    tags: defaultTags,
  })
})

// 空オブジェクトはデフォルト値を返すことを確認する
test("normalizeOptions: 空オブジェクトはデフォルト値を返す", () => {
  const result = normalizeOptions({})
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: true,
    allowPlaceholders: true,
    tags: defaultTags,
  })
})

// allowDecorations のみ指定した場合の正規化を確認する
test("normalizeOptions: allowDecorations のみ指定", () => {
  const result = normalizeOptions({ allowDecorations: false })
  assert.deepStrictEqual(result, {
    allowDecorations: false,
    allowAttributes: true,
    allowPlaceholders: true,
    tags: defaultTags,
  })
})

// allowAttributes のみ指定した場合の正規化を確認する
test("normalizeOptions: allowAttributes のみ指定", () => {
  const result = normalizeOptions({ allowAttributes: false })
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: false,
    allowPlaceholders: true,
    tags: defaultTags,
  })
})

// allowPlaceholders のみ指定した場合の正規化を確認する
test("normalizeOptions: allowPlaceholders のみ指定", () => {
  const result = normalizeOptions({ allowPlaceholders: false })
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: true,
    allowPlaceholders: false,
    tags: defaultTags,
  })
})

// 両方 false を指定した場合の正規化を確認する
test("normalizeOptions: 両方 false を指定", () => {
  const result = normalizeOptions({
    allowDecorations: false,
    allowAttributes: false,
  })
  assert.deepStrictEqual(result, {
    allowDecorations: false,
    allowAttributes: false,
    allowPlaceholders: true,
    tags: defaultTags,
  })
})

// 全て false を指定した場合の正規化を確認する
test("normalizeOptions: 全て false を指定", () => {
  const result = normalizeOptions({
    allowDecorations: false,
    allowAttributes: false,
    allowPlaceholders: false,
  })
  assert.deepStrictEqual(result, {
    allowDecorations: false,
    allowAttributes: false,
    allowPlaceholders: false,
    tags: defaultTags,
  })
})

// 両方 true を明示指定した場合の正規化を確認する
test("normalizeOptions: 両方 true を明示指定", () => {
  const result = normalizeOptions({
    allowDecorations: true,
    allowAttributes: true,
  })
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: true,
    allowPlaceholders: true,
    tags: defaultTags,
  })
})

// --- tags バリデーション ---

// tags を指定した場合はそのまま使用されることを確認する
test("normalizeOptions: tags を指定するとそのまま使用される", () => {
  const result = normalizeOptions({ tags: [{ opening: "|", closing: "|" }] })
  assert.deepStrictEqual(result.tags, [{ opening: "|", closing: "|" }])
})

// 複数のデリミタペアを指定できることを確認する
test("normalizeOptions: 複数のデリミタペアを指定できる", () => {
  const tags = [
    { opening: "<", closing: ">" },
    { opening: "|", closing: "|" },
  ]
  const result = normalizeOptions({ tags })
  assert.deepStrictEqual(result.tags, tags)
})

// 空配列はエラーになることを確認する
test("normalizeOptions: tags 空配列はエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [] }), /tags must not be empty/)
})

// opening が2文字以上の場合はエラーになることを確認する
test("normalizeOptions: opening が2文字以上はエラー", () => {
  assert.throws(
    () => normalizeOptions({ tags: [{ opening: "<<", closing: ">" }] }),
    /must be exactly 1 character/,
  )
})

// closing が2文字以上の場合はエラーになることを確認する
test("normalizeOptions: closing が2文字以上はエラー", () => {
  assert.throws(
    () => normalizeOptions({ tags: [{ opening: "<", closing: ">>" }] }),
    /must be exactly 1 character/,
  )
})

// opening が空文字列の場合はエラーになることを確認する
test("normalizeOptions: opening が空文字列はエラー", () => {
  assert.throws(
    () => normalizeOptions({ tags: [{ opening: "", closing: ">" }] }),
    /must be exactly 1 character/,
  )
})

// closing が空文字列の場合はエラーになることを確認する
test("normalizeOptions: closing が空文字列はエラー", () => {
  assert.throws(
    () => normalizeOptions({ tags: [{ opening: "<", closing: "" }] }),
    /must be exactly 1 character/,
  )
})

// allowlist 外の文字はエラーになることを確認する
test("normalizeOptions: allowlist 外の文字はエラー (opening)", () => {
  assert.throws(
    () => normalizeOptions({ tags: [{ opening: "a", closing: ">" }] }),
    /not in allowed delimiter characters/,
  )
})

// allowlist 外の文字はエラーになることを確認する
test("normalizeOptions: allowlist 外の文字はエラー (closing)", () => {
  assert.throws(
    () => normalizeOptions({ tags: [{ opening: "<", closing: "a" }] }),
    /not in allowed delimiter characters/,
  )
})

// 制御文字はエラーになることを確認する
test("normalizeOptions: 制御文字はエラー", () => {
  assert.throws(
    () => normalizeOptions({ tags: [{ opening: "\0", closing: ">" }] }),
    /not in allowed delimiter characters/,
  )
})

// 非 ASCII 文字はエラーになることを確認する
test("normalizeOptions: 非 ASCII 文字はエラー", () => {
  assert.throws(
    () => normalizeOptions({ tags: [{ opening: "\u3008", closing: "\u3009" }] }),
    /not in allowed delimiter characters/,
  )
})

// 同一ペア内で opening === closing は許可されることを確認する
test("normalizeOptions: 同一ペア内で opening === closing は許可", () => {
  const result = normalizeOptions({ tags: [{ opening: "|", closing: "|" }] })
  assert.deepStrictEqual(result.tags, [{ opening: "|", closing: "|" }])
})

// 異なるペア間でデリミタ文字が重複する場合はエラーになることを確認する
test("normalizeOptions: 異なるペア間でデリミタ文字が重複するとエラー", () => {
  assert.throws(
    () =>
      normalizeOptions({
        tags: [
          { opening: "<", closing: ">" },
          { opening: "<", closing: "|" },
        ],
      }),
    /duplicate delimiter character/,
  )
})

// 異なるペア間で closing 同士が重複する場合はエラーになることを確認する
test("normalizeOptions: 異なるペア間で closing 同士が重複するとエラー", () => {
  assert.throws(
    () =>
      normalizeOptions({
        tags: [
          { opening: "<", closing: ">" },
          { opening: "|", closing: ">" },
        ],
      }),
    /duplicate delimiter character/,
  )
})

// 異なるペア間で opening と closing が衝突する場合はエラーになることを確認する
test("normalizeOptions: 異なるペア間で opening と closing が衝突するとエラー", () => {
  assert.throws(
    () =>
      normalizeOptions({
        tags: [
          { opening: "<", closing: ">" },
          { opening: ">", closing: "|" },
        ],
      }),
    /duplicate delimiter character/,
  )
})

// allowlist の全文字がデリミタとして使用できることを確認する
test("normalizeOptions: allowlist の全文字がデリミタとして使用できる", () => {
  const allowedChars = "!#%&()*+;<>?@^|~"
  for (const ch of allowedChars) {
    const result = normalizeOptions({ tags: [{ opening: ch, closing: ch }] })
    assert.deepStrictEqual(result.tags, [{ opening: ch, closing: ch }])
  }
})
