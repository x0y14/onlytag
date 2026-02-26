import { test, assert } from "vitest"
import { normalizeOptions } from "../src/types.js"
import { onlytag } from "../src/onlytag.js"

// undefined はデフォルト値を返すことを確認する
test("normalizeOptions: undefined はデフォルト値を返す", () => {
  const result = normalizeOptions(undefined)
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: true,
    allowVariable: true,
    allowFunction: true,
  })
})

// 空オブジェクトはデフォルト値を返すことを確認する
test("normalizeOptions: 空オブジェクトはデフォルト値を返す", () => {
  const result = normalizeOptions({})
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: true,
    allowVariable: true,
    allowFunction: true,
  })
})

// allowDecorations のみ指定した場合の正規化を確認する
test("normalizeOptions: allowDecorations のみ指定", () => {
  const result = normalizeOptions({ allowDecorations: false })
  assert.deepStrictEqual(result, {
    allowDecorations: false,
    allowAttributes: true,
    allowVariable: true,
    allowFunction: true,
  })
})

// allowAttributes のみ指定した場合の正規化を確認する
test("normalizeOptions: allowAttributes のみ指定", () => {
  const result = normalizeOptions({ allowAttributes: false })
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: false,
    allowVariable: true,
    allowFunction: true,
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
    allowVariable: true,
    allowFunction: true,
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
    allowVariable: true,
    allowFunction: true,
  })
})

// allowVariable=false で変数を含む入力を拒否することを確認する
test("normalizeOptions: allowVariable=false で変数を拒否する", () => {
  const ot = new onlytag({ allowVariable: false })
  assert.throws(() => {
    ot.tokenize("<A mode=$dark />")
  }, /variable is not allowed/)
})

// allowFunction=false で関数を含む入力を拒否することを確認する
test("normalizeOptions: allowFunction=false で関数を拒否する", () => {
  const ot = new onlytag({ allowFunction: false })
  assert.throws(() => {
    ot.tokenize('<A cond=equal($mode,"dark") />')
  }, /function is not allowed/)
})

// allowVariable=true（デフォルト）で変数を含む入力を受理することを確認する
test("normalizeOptions: allowVariable=true（デフォルト）で変数を受理する", () => {
  const ot = new onlytag()
  const doc = ot.parse(ot.tokenize("<A mode=$dark />"))
  assert.deepStrictEqual(doc.children[0].attributes["mode"], {
    type: "variable",
    name: "dark",
  })
})

// allowFunction=true（デフォルト）で関数を含む入力を受理することを確認する
test("normalizeOptions: allowFunction=true（デフォルト）で関数を受理する", () => {
  const ot = new onlytag()
  const doc = ot.parse(ot.tokenize('<A cond=equal($mode,"dark") />'))
  assert.deepStrictEqual(doc.children[0].attributes["cond"], {
    type: "function",
    name: "equal",
    args: [{ type: "variable", name: "mode" }, "dark"],
  })
})

// allowVariable=false でパース時にも拒否されることを確認する（直接トークン渡し）
test("normalizeOptions: allowVariable=false でパース時に VARIABLE トークンを拒否する", () => {
  const ot = new onlytag({ allowVariable: false })
  const tokens = [
    { kind: "LT" as const, value: "<", position: 0 },
    { kind: "IDENT" as const, value: "A", position: 1 },
    { kind: "IDENT" as const, value: "mode", position: 3 },
    { kind: "EQUALS" as const, value: "=", position: 7 },
    { kind: "VARIABLE" as const, value: "$dark", position: 8 },
    { kind: "SLASH_GT" as const, value: "/>", position: 13 },
    { kind: "EOF" as const, value: "", position: 15 },
  ]
  assert.throws(() => ot.parse(tokens), /variable is not allowed/)
})

