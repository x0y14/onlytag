import { test, assert } from "vitest"
import { normalizeOptions } from "../src/types.js"
import { onlytag } from "../src/onlytag.js"

// undefined はデフォルト値を返すことを確認する
test("normalizeOptions: undefined はデフォルト値を返す", () => {
  const result = normalizeOptions(undefined)
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: true,
    allowInject: true,
    allowLogic: true,
  })
})

// 空オブジェクトはデフォルト値を返すことを確認する
test("normalizeOptions: 空オブジェクトはデフォルト値を返す", () => {
  const result = normalizeOptions({})
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: true,
    allowInject: true,
    allowLogic: true,
  })
})

// allowDecorations のみ指定した場合の正規化を確認する
test("normalizeOptions: allowDecorations のみ指定", () => {
  const result = normalizeOptions({ allowDecorations: false })
  assert.deepStrictEqual(result, {
    allowDecorations: false,
    allowAttributes: true,
    allowInject: true,
    allowLogic: true,
  })
})

// allowAttributes のみ指定した場合の正規化を確認する
test("normalizeOptions: allowAttributes のみ指定", () => {
  const result = normalizeOptions({ allowAttributes: false })
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: false,
    allowInject: true,
    allowLogic: true,
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
    allowInject: true,
    allowLogic: true,
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
    allowInject: true,
    allowLogic: true,
  })
})

// allowInject=false でインジェクトを含む入力を拒否することを確認する
test("normalizeOptions: allowInject=false でインジェクトを拒否する", () => {
  const ot = new onlytag({ allowInject: false })
  assert.throws(() => {
    ot.tokenize("<A mode=$dark />")
  }, /inject is not allowed/)
})

// allowLogic=false でロジックを含む入力を拒否することを確認する
test("normalizeOptions: allowLogic=false でロジックを拒否する", () => {
  const ot = new onlytag({ allowLogic: false })
  assert.throws(() => {
    ot.tokenize('<A cond=equal($mode,"dark") />')
  }, /logic is not allowed/)
})

// allowInject=true（デフォルト）でインジェクトを含む入力を受理することを確認する
test("normalizeOptions: allowInject=true（デフォルト）でインジェクトを受理する", () => {
  const ot = new onlytag()
  const doc = ot.parse(ot.tokenize("<A mode=$dark />"))
  assert.deepStrictEqual(doc.children[0].attributes["mode"], {
    type: "inject",
    name: "dark",
  })
})

// allowLogic=true（デフォルト）でロジックを含む入力を受理することを確認する
test("normalizeOptions: allowLogic=true（デフォルト）でロジックを受理する", () => {
  const ot = new onlytag()
  const doc = ot.parse(ot.tokenize('<A cond=equal($mode,"dark") />'))
  assert.deepStrictEqual(doc.children[0].attributes["cond"], {
    type: "logic",
    name: "equal",
    args: [{ type: "inject", name: "mode" }, "dark"],
  })
})

// allowInject=false でパース時にも拒否されることを確認する（直接トークン渡し）
test("normalizeOptions: allowInject=false でパース時に INJECT トークンを拒否する", () => {
  const ot = new onlytag({ allowInject: false })
  const tokens = [
    { kind: "LT" as const, value: "<", position: 0 },
    { kind: "IDENT" as const, value: "A", position: 1 },
    { kind: "IDENT" as const, value: "mode", position: 3 },
    { kind: "EQUALS" as const, value: "=", position: 7 },
    { kind: "INJECT" as const, value: "$dark", position: 8 },
    { kind: "SLASH_GT" as const, value: "/>", position: 13 },
    { kind: "EOF" as const, value: "", position: 15 },
  ]
  assert.throws(() => ot.parse(tokens), /inject is not allowed/)
})

