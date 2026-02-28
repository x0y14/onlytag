import { test, assert } from "vitest"
import { onlytag } from "../src/onlytag.js"
import type { Token } from "../src/token.js"

const ot = new onlytag()

function expectParserErrorWithPosition(input: string): void {
  let error: unknown
  try {
    ot.parse(ot.tokenize(input))
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /position|pos|index|offset/i)
}

// 閉じタグ名が一致しない入力は失敗することを確認する
test("parser error: mismatched closing tag fails", () => {
  expectParserErrorWithPosition("<A></B>")
})

// 余分な閉じタグのみの入力は失敗することを確認する
test("parser error: stray closing tag fails", () => {
  expectParserErrorWithPosition("</A>")
})

// 閉じタグが欠落した入力は失敗することを確認する
test("parser error: missing closing tag fails", () => {
  expectParserErrorWithPosition("<A><B /></A")
})

// ネスト構造で閉じタグが不一致の入力は失敗することを確認する
test("parser error: nested closing tag mismatch fails", () => {
  expectParserErrorWithPosition("<A><B></A></B>")
})

// 自己閉じタグの後に余分な閉じタグがある入力は失敗することを確認する
test("parser error: extra close tag after self-closing element fails", () => {
  expectParserErrorWithPosition("<A /></A>")
})

// EOF到達時に閉じタグ不足なら失敗することを確認する
test("parser error: eof before closing tag fails", () => {
  expectParserErrorWithPosition("<A>")
})

// タグ名にアンダースコアを含む入力は成功することを確認する
test("parser error: tag name with underscore succeeds", () => {
  const ot2 = new onlytag()
  const doc = ot2.parse(ot2.tokenize("<A_b />"))
  assert.strictEqual(doc.children[0].name, "A_b")
})

// 閉じタグ名にアンダースコアを含む入力は成功することを確認する
test("parser error: closing tag name with underscore succeeds", () => {
  const ot2 = new onlytag()
  const doc = ot2.parse(ot2.tokenize("<A_b></A_b>"))
  assert.strictEqual(doc.children[0].name, "A_b")
})

// タグ名が先頭アンダースコアの入力は失敗することを確認する
test("parser error: tag name starting with underscore fails", () => {
  expectParserErrorWithPosition("<_Tag />")
})

// タグ名が数字で始まる入力は失敗することを確認する
test("parser error: tag name starting with digit fails", () => {
  expectParserErrorWithPosition("<1Tag />")
})
test("parser error: missing equals before decoration fails", () => {
  let error: unknown
  try {
    ot.parse(ot.tokenize("<A flag .hot />"))
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /expected=<EQUALS>, actual=<DOT_IDENT>/)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// PLACEHOLDERトークンの値が "$" で始まらない場合にparse段で失敗することを確認する
test("parser error: placeholder token not starting with $ fails", () => {
  const tokens: Token[] = [
    { kind: "LT", value: "<", position: 0 },
    { kind: "IDENT", value: "A", position: 1 },
    { kind: "IDENT", value: "x", position: 3 },
    { kind: "EQUALS", value: "=", position: 4 },
    { kind: "PLACEHOLDER", value: "abc", position: 5 },
    { kind: "SLASH_GT", value: "/>", position: 8 },
    { kind: "EOF", value: "", position: 10 },
  ]

  let error: unknown
  try {
    ot.parse(tokens)
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /expected to start with "\$"/)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// PLACEHOLDERトークンの値が "$" のみで名前が空の場合にparse段で失敗することを確認する
test("parser error: placeholder token with empty name fails", () => {
  const tokens: Token[] = [
    { kind: "LT", value: "<", position: 0 },
    { kind: "IDENT", value: "A", position: 1 },
    { kind: "IDENT", value: "x", position: 3 },
    { kind: "EQUALS", value: "=", position: 4 },
    { kind: "PLACEHOLDER", value: "$", position: 5 },
    { kind: "SLASH_GT", value: "/>", position: 6 },
    { kind: "EOF", value: "", position: 8 },
  ]

  let error: unknown
  try {
    ot.parse(tokens)
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /name is empty/)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// PLACEHOLDERトークンの名前に不正文字を含む場合にparse段で失敗することを確認する
test("parser error: placeholder token with invalid name characters fails", () => {
  const tokens: Token[] = [
    { kind: "LT", value: "<", position: 0 },
    { kind: "IDENT", value: "A", position: 1 },
    { kind: "IDENT", value: "x", position: 3 },
    { kind: "EQUALS", value: "=", position: 4 },
    { kind: "PLACEHOLDER", value: "$1abc", position: 5 },
    { kind: "SLASH_GT", value: "/>", position: 10 },
    { kind: "EOF", value: "", position: 12 },
  ]

  let error: unknown
  try {
    ot.parse(tokens)
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /contains invalid characters/)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// 異なるデリミタペアで開閉した場合にエラーになることを確認する
test("parser error: cross-delimiter mismatch fails", () => {
  const otMulti = new onlytag({
    tags: [
      { opening: "<", closing: ">" },
      { opening: "!", closing: "?" },
    ],
  })
  // <A で開いて ? で閉じる不正なトークン列を手動構築
  const tokens: Token[] = [
    { kind: "LT", value: "<", position: 0, pairIndex: 0 },
    { kind: "IDENT", value: "A", position: 1 },
    { kind: "GT", value: ">", position: 2, pairIndex: 0 },
    { kind: "LT_SLASH", value: "!/", position: 3, pairIndex: 1 },
    { kind: "IDENT", value: "A", position: 5 },
    { kind: "GT", value: "?", position: 6, pairIndex: 1 },
    { kind: "EOF", value: "", position: 7 },
  ]

  let error: unknown
  try {
    otMulti.parse(tokens)
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /mismatched delimiter pair/)
  assert.match((error as Error).message, /'<\.\.\.>'/)
  assert.match((error as Error).message, /'!\.\.\.\?'/)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// 自己閉じタグで LT と SLASH_GT の pairIndex が異なる場合にエラーになることを確認する
test("parser error: self-closing tag cross-delimiter mismatch fails", () => {
  const otMulti = new onlytag({
    tags: [
      { opening: "<", closing: ">" },
      { opening: "!", closing: "?" },
    ],
  })
  const tokens: Token[] = [
    { kind: "LT", value: "<", position: 0, pairIndex: 0 },
    { kind: "IDENT", value: "A", position: 1 },
    { kind: "SLASH_GT", value: "/?", position: 2, pairIndex: 1 },
    { kind: "EOF", value: "", position: 4 },
  ]

  let error: unknown
  try {
    otMulti.parse(tokens)
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /mismatched delimiter pair/)
  assert.match((error as Error).message, /'<\.\.\.>'/)
  assert.match((error as Error).message, /'!\.\.\.\?'/)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// --- グループ値のエラーケース ---

// グループ内の不正なトークンでparse段で失敗することを確認する
test("parser error: invalid token inside group fails", () => {
  const tokens: Token[] = [
    { kind: "LT", value: "<", position: 0 },
    { kind: "IDENT", value: "A", position: 1 },
    { kind: "IDENT", value: "eq", position: 3 },
    { kind: "EQUALS", value: "=", position: 5 },
    { kind: "LPAREN", value: "(", position: 6 },
    { kind: "IDENT", value: "bad", position: 7 },
    { kind: "RPAREN", value: ")", position: 10 },
    { kind: "SLASH_GT", value: "/>", position: 11 },
    { kind: "EOF", value: "", position: 13 },
  ]

  let error: unknown
  try {
    ot.parse(tokens)
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// 不正なJSON_VALUEトークンを含む場合にparse段で失敗することを確認する
test("parser error: invalid json token payload fails in parse stage", () => {
  const tokens: Token[] = [
    { kind: "LT", value: "<", position: 0 },
    { kind: "IDENT", value: "A", position: 1 },
    { kind: "IDENT", value: "config", position: 3 },
    { kind: "EQUALS", value: "=", position: 9 },
    { kind: "JSON_VALUE", value: "{", position: 10 },
    { kind: "SLASH_GT", value: "/>", position: 11 },
    { kind: "EOF", value: "", position: 13 },
  ]

  let error: unknown
  try {
    ot.parse(tokens)
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /invalid json attribute/i)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// --- allowMixedDelimiters ---

// allowMixedDelimiters=false のとき、同一タグ名を別デリミタペアで使用するとエラーになることを確認する
test("parser error: allowMixedDelimiters=false で同一タグ名を別デリミタで使うとエラー", () => {
  const ot = new onlytag({
    allowMixedDelimiters: false,
    tags: [
      { opening: "<", closing: ">" },
      { opening: "|", closing: "|" },
    ],
  })
  // <tag /> で '<...>' を登録した後、|tag/| で '|...|' を使う
  let error: unknown
  try {
    ot.parse(ot.tokenize("<tag />|tag/|"))
  } catch (caught) {
    error = caught
  }
  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /mixed delimiter pair/)
  assert.match((error as Error).message, /'<\.\.\.>'/)
  assert.match((error as Error).message, /'\|\.\.\.\|'/)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// allowMixedDelimiters=true のとき、同一タグ名を別デリミタペアで使用しても成功することを確認する
test("parser error: allowMixedDelimiters=true で同一タグ名を別デリミタで使っても成功", () => {
  const ot = new onlytag({
    allowMixedDelimiters: true,
    tags: [
      { opening: "<", closing: ">" },
      { opening: "|", closing: "|" },
    ],
  })
  const tokens = ot.tokenize("<tag />|tag/|")
  const doc = ot.parse(tokens)
  assert.strictEqual(doc.type, "document")
})

// allowMixedDelimiters=false のとき、同一タグ名を同じデリミタで使うと成功することを確認する
test("parser error: allowMixedDelimiters=false で同一タグ名を同じデリミタで使うと成功", () => {
  const ot = new onlytag({
    allowMixedDelimiters: false,
    tags: [
      { opening: "<", closing: ">" },
      { opening: "|", closing: "|" },
    ],
  })
  const tokens = ot.tokenize("<tag></tag><tag />")
  const doc = ot.parse(tokens)
  assert.strictEqual(doc.type, "document")
})

// --- allowInconsistentClosures ---

// allowInconsistentClosures=false のとき、open/close → self-closing の順で使うとエラーになることを確認する
test("parser error: allowInconsistentClosures=false で open/close の後に self-closing を使うとエラー", () => {
  const ot = new onlytag({ allowInconsistentClosures: false })
  let error: unknown
  try {
    ot.parse(ot.tokenize("<tag></tag><tag />"))
  } catch (caught) {
    error = caught
  }
  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /inconsistent closure/)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// allowInconsistentClosures=false のとき、self-closing → open/close の順で使うとエラーになることを確認する
test("parser error: allowInconsistentClosures=false で self-closing の後に open/close を使うとエラー", () => {
  const ot = new onlytag({ allowInconsistentClosures: false })
  let error: unknown
  try {
    ot.parse(ot.tokenize("<tag /><tag></tag>"))
  } catch (caught) {
    error = caught
  }
  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /inconsistent closure/)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// allowInconsistentClosures=true のとき、open/close と self-closing を混在させても成功することを確認する
test("parser error: allowInconsistentClosures=true で混在させても成功", () => {
  const ot = new onlytag({ allowInconsistentClosures: true })
  const tokens = ot.tokenize("<tag></tag><tag />")
  const doc = ot.parse(tokens)
  assert.strictEqual(doc.type, "document")
})

// allowInconsistentClosures=false のとき、同じ閉じ形式のみ使うと成功することを確認する
test("parser error: allowInconsistentClosures=false で同じ閉じ形式のみなら成功", () => {
  const ot = new onlytag({ allowInconsistentClosures: false })
  const tokens = ot.tokenize("<tag /><tag />")
  const doc = ot.parse(tokens)
  assert.strictEqual(doc.type, "document")
})

// --- 両オプション同時 ---

// allowMixedDelimiters=false かつ allowInconsistentClosures=false のとき、混在利用はエラーになることを確認する
test("parser error: allowMixedDelimiters=false かつ allowInconsistentClosures=false で混在はエラー", () => {
  const ot = new onlytag({
    allowMixedDelimiters: false,
    allowInconsistentClosures: false,
    tags: [
      { opening: "<", closing: ">" },
      { opening: "|", closing: "|" },
    ],
  })
  // mixed delimiter: <tag /> を登録後に |tag/| で違うペアを使う
  let mixedError: unknown
  try {
    ot.parse(ot.tokenize("<tag />|tag/|"))
  } catch (caught) {
    mixedError = caught
  }
  assert.instanceOf(mixedError, Error)
  assert.match((mixedError as Error).message, /mixed delimiter pair/)
})

// allowMixedDelimiters=false かつ allowInconsistentClosures=false のとき、同じデリミタで same-type のみなら成功することを確認する
test("parser error: allowMixedDelimiters=false かつ allowInconsistentClosures=false で同じペア・同じ閉じ形式なら成功", () => {
  const ot = new onlytag({
    allowMixedDelimiters: false,
    allowInconsistentClosures: false,
    tags: [
      { opening: "<", closing: ">" },
      { opening: "|", closing: "|" },
    ],
  })
  const tokens = ot.tokenize("<foo /><foo /><bar></bar>")
  const doc = ot.parse(tokens)
  assert.strictEqual(doc.type, "document")
})

// allowPlaceholders=false のときグループ内の PLACEHOLDER はエラーになることを確認する
test("parser error: placeholder in group disallowed when allowPlaceholders=false", () => {
  const otNoPh = new onlytag({ allowPlaceholders: false })
  const tokens: Token[] = [
    { kind: "LT", value: "<", position: 0 },
    { kind: "IDENT", value: "A", position: 1 },
    { kind: "IDENT", value: "eq", position: 3 },
    { kind: "EQUALS", value: "=", position: 5 },
    { kind: "LPAREN", value: "(", position: 6 },
    { kind: "PLACEHOLDER", value: "$mode", position: 7 },
    { kind: "RPAREN", value: ")", position: 12 },
    { kind: "SLASH_GT", value: "/>", position: 13 },
    { kind: "EOF", value: "", position: 15 },
  ]

  let error: unknown
  try {
    otNoPh.parse(tokens)
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /placeholders are not allowed/)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// グループ内の PLACEHOLDER トークンが "$" で始まらない場合にparse段で失敗することを確認する
test("parser error: placeholder in group not starting with $ fails", () => {
  const tokens: Token[] = [
    { kind: "LT", value: "<", position: 0 },
    { kind: "IDENT", value: "A", position: 1 },
    { kind: "IDENT", value: "eq", position: 3 },
    { kind: "EQUALS", value: "=", position: 5 },
    { kind: "LPAREN", value: "(", position: 6 },
    { kind: "PLACEHOLDER", value: "abc", position: 7 },
    { kind: "RPAREN", value: ")", position: 10 },
    { kind: "SLASH_GT", value: "/>", position: 11 },
    { kind: "EOF", value: "", position: 13 },
  ]

  let error: unknown
  try {
    ot.parse(tokens)
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /expected to start with "\$"/)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// グループ内の PLACEHOLDER トークンが "$" のみで名前が空の場合にparse段で失敗することを確認する
test("parser error: placeholder in group with empty name fails", () => {
  const tokens: Token[] = [
    { kind: "LT", value: "<", position: 0 },
    { kind: "IDENT", value: "A", position: 1 },
    { kind: "IDENT", value: "eq", position: 3 },
    { kind: "EQUALS", value: "=", position: 5 },
    { kind: "LPAREN", value: "(", position: 6 },
    { kind: "PLACEHOLDER", value: "$", position: 7 },
    { kind: "RPAREN", value: ")", position: 8 },
    { kind: "SLASH_GT", value: "/>", position: 9 },
    { kind: "EOF", value: "", position: 11 },
  ]

  let error: unknown
  try {
    ot.parse(tokens)
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /name is empty/)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// グループ内の PLACEHOLDER トークンの名前に不正文字を含む場合にparse段で失敗することを確認する
test("parser error: placeholder in group with invalid name characters fails", () => {
  const tokens: Token[] = [
    { kind: "LT", value: "<", position: 0 },
    { kind: "IDENT", value: "A", position: 1 },
    { kind: "IDENT", value: "eq", position: 3 },
    { kind: "EQUALS", value: "=", position: 5 },
    { kind: "LPAREN", value: "(", position: 6 },
    { kind: "PLACEHOLDER", value: "$1abc", position: 7 },
    { kind: "RPAREN", value: ")", position: 12 },
    { kind: "SLASH_GT", value: "/>", position: 13 },
    { kind: "EOF", value: "", position: 15 },
  ]

  let error: unknown
  try {
    ot.parse(tokens)
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /contains invalid characters/)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// グループ内の JSON_VALUE トークンが不正な JSON の場合にparse段で失敗することを確認する
test("parser error: invalid json token in group fails", () => {
  const tokens: Token[] = [
    { kind: "LT", value: "<", position: 0 },
    { kind: "IDENT", value: "A", position: 1 },
    { kind: "IDENT", value: "eq", position: 3 },
    { kind: "EQUALS", value: "=", position: 5 },
    { kind: "LPAREN", value: "(", position: 6 },
    { kind: "JSON_VALUE", value: "{", position: 7 },
    { kind: "RPAREN", value: ")", position: 8 },
    { kind: "SLASH_GT", value: "/>", position: 9 },
    { kind: "EOF", value: "", position: 11 },
  ]

  let error: unknown
  try {
    ot.parse(tokens)
  } catch (caught) {
    error = caught
  }

  if (error === undefined) {
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>")
  }

  assert.instanceOf(error, Error)
  assert.match((error as Error).message, /invalid json attribute/i)
  assert.match((error as Error).message, /position|pos|index|offset/i)
})

// --- デコレーション重複 ---

// 同一デコレーション名が重複する場合にparse段で失敗することを確認する
test("parser error: duplicate decoration fails", () => {
  expectParserErrorWithPosition("<A .foo .foo />")
})

// --- 属性キー重複 ---

// JSON値の属性キーが重複する場合にparse段で失敗することを確認する
test("parser error: duplicate attribute key with json values fails", () => {
  expectParserErrorWithPosition('<A x=1 x=2 />')
})

// placeholder属性キーが重複する場合にparse段で失敗することを確認する
test("parser error: duplicate attribute key with placeholder fails", () => {
  expectParserErrorWithPosition('<A x=$foo x=$bar />')
})

// グループ値の属性キーが重複する場合にparse段で失敗することを確認する
test("parser error: duplicate attribute key with group value fails", () => {
  expectParserErrorWithPosition('<A x=(1,2) x=(3,4) />')
})
