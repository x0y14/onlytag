import { test, assert } from "vitest"
import { normalizeFeatureOptions } from "../src/types.js"

// undefined はデフォルト値を返すことを確認する
test("normalizeFeatureOptions: undefined はデフォルト値を返す", () => {
  const result = normalizeFeatureOptions(undefined)
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: true,
  })
})

// 空オブジェクトはデフォルト値を返すことを確認する
test("normalizeFeatureOptions: 空オブジェクトはデフォルト値を返す", () => {
  const result = normalizeFeatureOptions({})
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: true,
  })
})

// allowDecorations のみ指定した場合の正規化を確認する
test("normalizeFeatureOptions: allowDecorations のみ指定", () => {
  const result = normalizeFeatureOptions({ allowDecorations: false })
  assert.deepStrictEqual(result, {
    allowDecorations: false,
    allowAttributes: true,
  })
})

// allowAttributes のみ指定した場合の正規化を確認する
test("normalizeFeatureOptions: allowAttributes のみ指定", () => {
  const result = normalizeFeatureOptions({ allowAttributes: false })
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: false,
  })
})

// 両方 false を指定した場合の正規化を確認する
test("normalizeFeatureOptions: 両方 false を指定", () => {
  const result = normalizeFeatureOptions({
    allowDecorations: false,
    allowAttributes: false,
  })
  assert.deepStrictEqual(result, {
    allowDecorations: false,
    allowAttributes: false,
  })
})

// 両方 true を明示指定した場合の正規化を確認する
test("normalizeFeatureOptions: 両方 true を明示指定", () => {
  const result = normalizeFeatureOptions({
    allowDecorations: true,
    allowAttributes: true,
  })
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: true,
  })
})
