import { test, assert } from "vitest"
import { normalizeOptions } from "../src/types.js"

// undefined はデフォルト値を返すことを確認する
test("normalizeOptions: undefined はデフォルト値を返す", () => {
  const result = normalizeOptions(undefined)
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: true,
    tags: [{ opening: "<", closing: ">" }],
  })
})

// 空オブジェクトはデフォルト値を返すことを確認する
test("normalizeOptions: 空オブジェクトはデフォルト値を返す", () => {
  const result = normalizeOptions({})
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: true,
    tags: [{ opening: "<", closing: ">" }],
  })
})

// allowDecorations のみ指定した場合の正規化を確認する
test("normalizeOptions: allowDecorations のみ指定", () => {
  const result = normalizeOptions({ allowDecorations: false })
  assert.deepStrictEqual(result, {
    allowDecorations: false,
    allowAttributes: true,
    tags: [{ opening: "<", closing: ">" }],
  })
})

// allowAttributes のみ指定した場合の正規化を確認する
test("normalizeOptions: allowAttributes のみ指定", () => {
  const result = normalizeOptions({ allowAttributes: false })
  assert.deepStrictEqual(result, {
    allowDecorations: true,
    allowAttributes: false,
    tags: [{ opening: "<", closing: ">" }],
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
    tags: [{ opening: "<", closing: ">" }],
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
    tags: [{ opening: "<", closing: ">" }],
  })
})

// カスタムタグデリミタを指定した場合の正規化を確認する
test("normalizeOptions: カスタムタグデリミタを指定", () => {
  const result = normalizeOptions({
    tags: [
      { opening: "<", closing: ">" },
      { opening: "|", closing: "|" },
    ],
  })
  assert.deepStrictEqual(result.tags, [
    { opening: "<", closing: ">" },
    { opening: "|", closing: "|" },
  ])
})

// 空のタグリストを指定した場合の正規化を確認する
test("normalizeOptions: 空のタグリストを指定", () => {
  const result = normalizeOptions({ tags: [] })
  assert.deepStrictEqual(result.tags, [])
})

// 予約済み文字（英字）を opening に使うとエラーになることを確認する
test("normalizeOptions: 予約済み文字を opening に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "a", closing: ">" }] }), /invalid opening delimiter/)
})

// 予約済み文字（英字）を closing に使うとエラーになることを確認する
test("normalizeOptions: 予約済み文字を closing に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "<", closing: "z" }] }), /invalid closing delimiter/)
})

// 予約済み文字（ドット）を opening に使うとエラーになることを確認する
test("normalizeOptions: ドットを opening に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: ".", closing: ">" }] }), /invalid opening delimiter/)
})

// 予約済み文字（イコール）を closing に使うとエラーになることを確認する
test("normalizeOptions: イコールを closing に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "<", closing: "=" }] }), /invalid closing delimiter/)
})

// 予約済み文字（スラッシュ）を opening に使うとエラーになることを確認する
test("normalizeOptions: スラッシュを opening に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "/", closing: ">" }] }), /invalid opening delimiter/)
})

// 空白文字を closing に使うとエラーになることを確認する
test("normalizeOptions: 空白文字を closing に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "<", closing: " " }] }), /invalid closing delimiter/)
})

// 2文字以上の文字列を opening に使うとエラーになることを確認する（長さチェック）
test("normalizeOptions: 2文字以上の opening はエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "<<", closing: ">" }] }), /invalid opening delimiter/)
})

// アンダースコアを opening に使うとエラーになることを確認する
test("normalizeOptions: アンダースコアを opening に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "_", closing: ">" }] }), /invalid opening delimiter/)
})

// ハイフンを closing に使うとエラーになることを確認する
test("normalizeOptions: ハイフンを closing に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "<", closing: "-" }] }), /invalid closing delimiter/)
})

// シングルクォートを opening に使うとエラーになることを確認する
test("normalizeOptions: シングルクォートを opening に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "'", closing: ">" }] }), /invalid opening delimiter/)
})

// バッククォートを closing に使うとエラーになることを確認する
test("normalizeOptions: バッククォートを closing に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "<", closing: "`" }] }), /invalid closing delimiter/)
})

// バックスラッシュを opening に使うとエラーになることを確認する
test("normalizeOptions: バックスラッシュを opening に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "\\", closing: ">" }] }), /invalid opening delimiter/)
})

// 開き波括弧を opening に使うとエラーになることを確認する
test("normalizeOptions: 開き波括弧を opening に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "{", closing: ">" }] }), /invalid opening delimiter/)
})

// 閉じ波括弧を closing に使うとエラーになることを確認する
test("normalizeOptions: 閉じ波括弧を closing に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "<", closing: "}" }] }), /invalid closing delimiter/)
})

// 開き角括弧を opening に使うとエラーになることを確認する
test("normalizeOptions: 開き角括弧を opening に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "[", closing: ">" }] }), /invalid opening delimiter/)
})

// 閉じ角括弧を closing に使うとエラーになることを確認する
test("normalizeOptions: 閉じ角括弧を closing に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "<", closing: "]" }] }), /invalid closing delimiter/)
})

// 開き丸括弧を opening に使うとエラーになることを確認する
test("normalizeOptions: 開き丸括弧を opening に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "(", closing: ">" }] }), /invalid opening delimiter/)
})

// 閉じ丸括弧を closing に使うとエラーになることを確認する
test("normalizeOptions: 閉じ丸括弧を closing に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "<", closing: ")" }] }), /invalid closing delimiter/)
})

// カンマを opening に使うとエラーになることを確認する
test("normalizeOptions: カンマを opening に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: ",", closing: ">" }] }), /invalid opening delimiter/)
})

// 制御文字を opening に使うとエラーになることを確認する
test("normalizeOptions: 制御文字を opening に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "\x01", closing: ">" }] }), /invalid opening delimiter/)
})

// DEL (0x7F) を closing に使うとエラーになることを確認する
test("normalizeOptions: DEL を closing に使うとエラー", () => {
  assert.throws(() => normalizeOptions({ tags: [{ opening: "<", closing: "\x7f" }] }), /invalid closing delimiter/)
})

// 重複する opening デリミタはエラーになることを確認する
test("normalizeOptions: 重複する opening デリミタはエラー", () => {
  assert.throws(
    () => normalizeOptions({ tags: [{ opening: "<", closing: ">" }, { opening: "<", closing: "|" }] }),
    /duplicate opening delimiter/,
  )
})

// normalizeOptions の結果を変更しても DEFAULT_TAGS に影響しないことを確認する
test("normalizeOptions: 返り値の変更がデフォルトに影響しない", () => {
  const result1 = normalizeOptions(undefined)
  result1.tags[0].opening = "!"
  const result2 = normalizeOptions(undefined)
  assert.equal(result2.tags[0].opening, "<")
})
