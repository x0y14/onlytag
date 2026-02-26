import { test, assert } from "vitest"
import { onlytag } from "../src/onlytag.js"

const ot = new onlytag()

// 自己閉じタグと文字列属性のトークン列を確認する
test("tokenizer: self-closing tag with string attribute", () => {
  const tokens = ot.tokenize('<Title .primary text="Welcome to onlytag" />')
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, [
    "LT",
    "IDENT",
    "DOT_IDENT",
    "IDENT",
    "EQUALS",
    "JSON_VALUE",
    "SLASH_GT",
    "EOF",
  ])
  assert.equal(tokens.find((t) => t.kind === "IDENT")!.value, "Title")
  assert.equal(tokens.find((t) => t.kind === "DOT_IDENT")!.value, ".primary")
  assert.equal(tokens.find((t) => t.kind === "JSON_VALUE")!.value, '"Welcome to onlytag"')
})

// 開始タグと終了タグのペアをトークン化できることを確認する
test("tokenizer: open and close tag pair", () => {
  const tokens = ot.tokenize("<AppLayout></AppLayout>")
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, ["LT", "IDENT", "GT", "LT_SLASH", "IDENT", "GT", "EOF"])
})

// 数値属性がJSON_VALUEとして取得できることを確認する
test("tokenizer: numeric attribute", () => {
  const tokens = ot.tokenize("<Identity level=42 />")
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE")
  assert.equal(jsonToken!.value, "42")
})

// JSONオブジェクト属性がJSON_VALUEとして取得できることを確認する
test("tokenizer: json object attribute", () => {
  const tokens = ot.tokenize('<Stats base={"hp": 1500, "mp": 800} />')
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE")
  assert.equal(jsonToken!.value, '{"hp": 1500, "mp": 800}')
})

// JSON配列属性がJSON_VALUEとして取得できることを確認する
test("tokenizer: json array attribute", () => {
  const tokens = ot.tokenize("<Stats modifiers=[1.2, 0.9, 1.05] />")
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE")
  assert.equal(jsonToken!.value, "[1.2, 0.9, 1.05]")
})

// 真偽値属性がJSON_VALUEとして取得できることを確認する
test("tokenizer: boolean attribute", () => {
  const tokens = ot.tokenize("<Payload success=true />")
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE")
  assert.equal(jsonToken!.value, "true")
})

// null属性がJSON_VALUEとして取得できることを確認する
test("tokenizer: null attribute", () => {
  const tokens = ot.tokenize("<Skills passive=null />")
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE")
  assert.equal(jsonToken!.value, "null")
})

// 複数デコレーションを順序どおり取得できることを確認する
test("tokenizer: multiple decorations", () => {
  const tokens = ot.tokenize("<Character .hero .rare_ssr />")
  const decos = tokens.filter((t) => t.kind === "DOT_IDENT")
  assert.equal(decos.length, 2)
  assert.equal(decos[0].value, ".hero")
  assert.equal(decos[1].value, ".rare_ssr")
})

// 空白差分がトークン列に影響しないことを確認する
test("tokenizer: ignores whitespace differences", () => {
  const compact = ot.tokenize("<A .b c=1 />")
  const spaced = ot.tokenize("<  A   .b   c=1   />")
  assert.deepStrictEqual(
    compact.map((t) => t.kind),
    spaced.map((t) => t.kind),
  )
  assert.deepStrictEqual(
    compact.map((t) => t.value),
    spaced.map((t) => t.value),
  )
})

// 空入力はEOFのみを返すことを確認する
test("tokenizer: empty input returns only eof", () => {
  const tokens = ot.tokenize("")
  assert.equal(tokens.length, 1)
  assert.equal(tokens[0].kind, "EOF")
})

// ネストしたJSON配列属性をJSON_VALUEとして取得できることを確認する
test("tokenizer: nested json array attribute", () => {
  const tokens = ot.tokenize(
    '<NavigationMenu items=[{"label": "Home", "href": "/"}, {"label": "Docs", "href": "/docs"}] />',
  )
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE")
  assert.equal(
    jsonToken!.value,
    '[{"label": "Home", "href": "/"}, {"label": "Docs", "href": "/docs"}]',
  )
})

// 識別子の許可文字を含むタグ名と属性名を取得できることを確認する
test("tokenizer: accepts allowed identifier characters", () => {
  const tokens = ot.tokenize("<A_1-b c_2-d=1 />")
  const idents = tokens.filter((t) => t.kind === "IDENT").map((t) => t.value)
  assert.deepStrictEqual(idents, ["A_1-b", "c_2-d"])
})

// デコレーション名の許可文字を取得できることを確認する
test("tokenizer: accepts allowed decoration characters", () => {
  const tokens = ot.tokenize("<Card .x-1_y />")
  const deco = tokens.find((t) => t.kind === "DOT_IDENT")
  assert.equal(deco!.value, ".x-1_y")
})

// 文字列・数値・真偽値・null・配列・オブジェクト属性を順に取得できることを確認する
test("tokenizer: mixed json attribute values", () => {
  const tokens = ot.tokenize('<A s="x" n=-1.25 b=false z=null arr=[1,2] obj={"k":"v"} />')
  const values = tokens.filter((t) => t.kind === "JSON_VALUE").map((t) => t.value)
  assert.deepStrictEqual(values, ['"x"', "-1.25", "false", "null", "[1,2]", '{"k":"v"}'])
})

// エスケープを含む文字列属性を正しく取得できることを確認する
test("tokenizer: escaped string attribute", () => {
  const tokens = ot.tokenize('<A msg="a\\\"b\\\\c" />')
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE")
  assert.equal(jsonToken!.value, '"a\\\"b\\\\c"')
})

// READMEのAppLayout例先頭部をトークナイズできることを確認する
test("tokenizer: tokenizes README AppLayout prefix", () => {
  const input = `
    <AppLayout>
      <Header .fixed .glassmorphism>
        <NavigationMenu items=[{"label":"Home","href":"/"}] />
      </Header>
    </AppLayout>
  `
  const tokens = ot.tokenize(input)
  assert.equal(tokens[0].kind, "LT")
  assert.equal(tokens[tokens.length - 1].kind, "EOF")
  assert.isAtLeast(tokens.length, 10)
})

// JSON属性の終端を空白境界で正しく判定できることを確認する
test("tokenizer: detects json boundary before next attribute", () => {
  const tokens = ot.tokenize('<A config={"k":1} next=2 />')
  const values = tokens.filter((t) => t.kind === "JSON_VALUE").map((t) => t.value)
  assert.deepStrictEqual(values, ['{"k":1}', "2"])
})

// '<'と'/'の間の空白を許可することを確認する
test("tokenizer: allows whitespace between < and / in closing tag", () => {
  const tokens = ot.tokenize("<A>< /A>")
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, ["LT", "IDENT", "GT", "LT_SLASH", "IDENT", "GT", "EOF"])
})

// JSON属性の終端を/>境界で正しく判定できることを確認する
test("tokenizer: detects json boundary before slash-gt", () => {
  const tokens = ot.tokenize('<A config={"k":1}/>')
  const value = tokens.find((t) => t.kind === "JSON_VALUE")
  assert.equal(value!.value, '{"k":1}')
})

// 変数がDOLLAR_IDENTトークンとして取得できることを確認する
test("tokenizer: variable emits DOLLAR_IDENT token", () => {
  const tokens = ot.tokenize("<A $myVar />")
  const varToken = tokens.find((t) => t.kind === "DOLLAR_IDENT")
  assert.equal(varToken!.value, "$myVar")
})

// 複数の変数を順に取得できることを確認する
test("tokenizer: multiple variables", () => {
  const tokens = ot.tokenize("<A $foo $bar-1 />")
  const varTokens = tokens.filter((t) => t.kind === "DOLLAR_IDENT")
  assert.equal(varTokens.length, 2)
  assert.equal(varTokens[0].value, "$foo")
  assert.equal(varTokens[1].value, "$bar-1")
})

// JSON属性と変数を混在できることを確認する
test("tokenizer: mixed json attributes and variables", () => {
  const tokens = ot.tokenize('<A level=42 $myVar name="test" />')
  const jsonTokens = tokens.filter((t) => t.kind === "JSON_VALUE").map((t) => t.value)
  const varTokens = tokens.filter((t) => t.kind === "DOLLAR_IDENT").map((t) => t.value)
  assert.deepStrictEqual(jsonTokens, ["42", '"test"'])
  assert.deepStrictEqual(varTokens, ["$myVar"])
})
