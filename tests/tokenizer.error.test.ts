import { test, assert } from "vitest"
import { onlytag } from "../src/onlytag.js"

const ot = new onlytag()
const otNoPh = new onlytag({ allowPlaceholders: false })

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
  assert.match((error as Error).message, /position|pos|index|offset/i)
}

// タグ名に不正文字を含む入力は失敗することを確認する
test("tokenizer error: invalid character in tag name fails", () => {
  expectTokenizerErrorWithPosition("<A@ />")
})

// 未終了の文字列属性は失敗することを確認する
test("tokenizer error: unterminated string attribute fails", () => {
  expectTokenizerErrorWithPosition('<A name="Lumina />')
})

// 未終了のJSONオブジェクト属性は失敗することを確認する
test("tokenizer error: unterminated json object attribute fails", () => {
  expectTokenizerErrorWithPosition('<A data={"hp": 100 />')
})

// 属性値が欠落している場合は失敗することを確認する
test("tokenizer error: missing attribute value fails", () => {
  expectTokenizerErrorWithPosition("<A level= />")
})

// デコレーションに不正文字を含む入力は失敗することを確認する
test("tokenizer error: invalid character in decoration fails", () => {
  expectTokenizerErrorWithPosition("<A .bad! />")
})

// 入力終端まで属性値がない場合は失敗することを確認する
test("tokenizer error: missing attribute value at eof fails", () => {
  expectTokenizerErrorWithPosition("<A level=   ")
})

// 不正なtrueリテラルは失敗することを確認する
test("tokenizer error: invalid true literal fails", () => {
  expectTokenizerErrorWithPosition("<A ok=tru />")
})

// 不正なfalseリテラルは失敗することを確認する
test("tokenizer error: invalid false literal fails", () => {
  expectTokenizerErrorWithPosition("<A ok=fals />")
})

// 不正なnullリテラルは失敗することを確認する
test("tokenizer error: invalid null literal fails", () => {
  expectTokenizerErrorWithPosition("<A ok=nul />")
})

// JSON値の直後に境界なしで識別子が続く入力は失敗することを確認する
test("tokenizer error: missing boundary after json value fails", () => {
  expectTokenizerErrorWithPosition('<A config={"k":1}next=2 />')
})

// $の後が数字で始まる placeholder は失敗することを確認する
test("tokenizer error: placeholder starting with digit fails", () => {
  expectTokenizerErrorWithPosition("<A attr=$1abc />")
})

// $の後が空白の placeholder は失敗することを確認する
test("tokenizer error: placeholder with only dollar sign fails", () => {
  expectTokenizerErrorWithPosition("<A attr=$ />")
})

// タグ名位置に $ は使用できないことを確認する
test("tokenizer error: dollar sign in tag name position fails", () => {
  expectTokenizerErrorWithPosition("<$ph />")
})

// デコレーション名位置に $ は使用できないことを確認する
test("tokenizer error: dollar sign in decoration position fails", () => {
  expectTokenizerErrorWithPosition("<A .$ph />")
})

// 属性名位置に $ は使用できないことを確認する
test("tokenizer error: dollar sign as attribute name fails", () => {
  expectTokenizerErrorWithPosition("<A $ph />")
})

// allowPlaceholders=false のとき placeholder はエラーになることを確認する
test("tokenizer error: placeholder disallowed when allowPlaceholders=false", () => {
  let error: unknown
  try {
    otNoPh.tokenize("<A attr=$abc />")
  } catch (caught) {
    error = caught
  }
  if (error === undefined) {
    assert.fail("missing tokenizer error: expected=<Error>, actual=<no-throw>")
  }
  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// --- カスタムデリミタのエラーケース ---

// 属性値に JSON として不正かつ境界でもない文字がある場合は失敗することを確認する
test("tokenizer error: invalid json value start character fails", () => {
  expectTokenizerErrorWithPosition("<A attr=@ />")
})

// タグ内部で / の直後が閉じデリミタでない場合は失敗することを確認する
test("tokenizer error: invalid slash token inside tag fails", () => {
  expectTokenizerErrorWithPosition("<A /x>")
})

// カスタムデリミタで未終了の文字列属性はエラーになることを確認する
test("tokenizer error: custom delimiter unterminated string fails", () => {
  const otPipe = new onlytag({ tags: [{ opening: "|", closing: "|" }] })
  let error: unknown
  try {
    otPipe.tokenize('|A name="Lumina /|')
  } catch (caught) {
    error = caught
  }
  if (error === undefined) {
    assert.fail("missing tokenizer error: expected=<Error>, actual=<no-throw>")
  }
  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// カスタムデリミタで属性値が欠落している場合はエラーになることを確認する
test("tokenizer error: custom delimiter missing attribute value fails", () => {
  const otPipe = new onlytag({ tags: [{ opening: "|", closing: "|" }] })
  let error: unknown
  try {
    otPipe.tokenize("|A level= /|")
  } catch (caught) {
    error = caught
  }
  if (error === undefined) {
    assert.fail("missing tokenizer error: expected=<Error>, actual=<no-throw>")
  }
  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// カスタムデリミタで不正文字はエラーになることを確認する
test("tokenizer error: custom delimiter invalid character fails", () => {
  const otPipe = new onlytag({ tags: [{ opening: "|", closing: "|" }] })
  let error: unknown
  try {
    otPipe.tokenize("|A@ /|")
  } catch (caught) {
    error = caught
  }
  if (error === undefined) {
    assert.fail("missing tokenizer error: expected=<Error>, actual=<no-throw>")
  }
  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})
