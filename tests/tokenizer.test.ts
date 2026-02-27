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

// placeholder トークンが PLACEHOLDER として取得できることを確認する
test("tokenizer: placeholder attribute value", () => {
  const tokens = ot.tokenize("<A attr=$myPlaceholder />")
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, [
    "LT",
    "IDENT",
    "IDENT",
    "EQUALS",
    "PLACEHOLDER",
    "SLASH_GT",
    "EOF",
  ])
  const ph = tokens.find((t) => t.kind === "PLACEHOLDER")
  assert.equal(ph!.value, "$myPlaceholder")
})

// placeholder 名はドル記号を含む生文字列であることを確認する
test("tokenizer: placeholder value includes dollar sign", () => {
  const tokens = ot.tokenize("<A x=$abc-123 />")
  const ph = tokens.find((t) => t.kind === "PLACEHOLDER")
  assert.equal(ph!.value, "$abc-123")
})

// JSON 値と placeholder が混在しても正しくトークナイズできることを確認する
test("tokenizer: mixed json and placeholder attributes", () => {
  const tokens = ot.tokenize("<A .deco json={} ph=$abc />")
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, [
    "LT",
    "IDENT",
    "DOT_IDENT",
    "IDENT",
    "EQUALS",
    "JSON_VALUE",
    "IDENT",
    "EQUALS",
    "PLACEHOLDER",
    "SLASH_GT",
    "EOF",
  ])
})

// --- カスタムデリミタ ---

// パイプデリミタで自己閉じタグをトークナイズできることを確認する
test("tokenizer: pipe delimiter self-closing tag", () => {
  const otPipe = new onlytag({ tags: [{ opening: "|", closing: "|" }] })
  const tokens = otPipe.tokenize("|A /|")
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, ["LT", "IDENT", "SLASH_GT", "EOF"])
})

// パイプデリミタで開閉タグをトークナイズできることを確認する
test("tokenizer: pipe delimiter open-close tag pair", () => {
  const otPipe = new onlytag({ tags: [{ opening: "|", closing: "|" }] })
  const tokens = otPipe.tokenize("|A|| /A|")
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, ["LT", "IDENT", "GT", "LT_SLASH", "IDENT", "GT", "EOF"])
})

// パーセントデリミタで属性付きタグをトークナイズできることを確認する
test("tokenizer: percent delimiter with attributes", () => {
  const otPercent = new onlytag({ tags: [{ opening: "%", closing: "%" }] })
  const tokens = otPercent.tokenize('%A name="hello" /%')
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, ["LT", "IDENT", "IDENT", "EQUALS", "JSON_VALUE", "SLASH_GT", "EOF"])
  assert.equal(tokens.find((t) => t.kind === "JSON_VALUE")!.value, '"hello"')
})

// カスタムデリミタでデコレーション付きタグをトークナイズできることを確認する
test("tokenizer: custom delimiter with decorations", () => {
  const otCustom = new onlytag({ tags: [{ opening: "!", closing: "?" }] })
  const tokens = otCustom.tokenize("!Card .elevated /?")
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, ["LT", "IDENT", "DOT_IDENT", "SLASH_GT", "EOF"])
  assert.equal(tokens.find((t) => t.kind === "DOT_IDENT")!.value, ".elevated")
})

// カスタムデリミタで JSON オブジェクト属性をトークナイズできることを確認する
test("tokenizer: custom delimiter with json object attribute", () => {
  const otCustom = new onlytag({ tags: [{ opening: "#", closing: "#" }] })
  const tokens = otCustom.tokenize('#Stats base={"hp": 100} /#')
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE")
  assert.equal(jsonToken!.value, '{"hp": 100}')
})

// 複数デリミタペアで混在入力をトークナイズできることを確認する
test("tokenizer: multiple delimiter pairs", () => {
  const otMulti = new onlytag({
    tags: [
      { opening: "<", closing: ">" },
      { opening: "!", closing: "?" },
    ],
  })
  const tokens1 = otMulti.tokenize("<A />")
  assert.deepStrictEqual(
    tokens1.map((t) => t.kind),
    ["LT", "IDENT", "SLASH_GT", "EOF"],
  )
  const tokens2 = otMulti.tokenize("!B /?")
  assert.deepStrictEqual(
    tokens2.map((t) => t.kind),
    ["LT", "IDENT", "SLASH_GT", "EOF"],
  )
})

// 複数デリミタペアを混在使用してネストしたタグをトークナイズできることを確認する
test("tokenizer: multiple delimiter pairs nested", () => {
  const otMulti = new onlytag({
    tags: [
      { opening: "<", closing: ">" },
      { opening: "!", closing: "?" },
    ],
  })
  const tokens = otMulti.tokenize("<A>!B /?</A>")
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, [
    "LT",
    "IDENT",
    "GT",
    "LT",
    "IDENT",
    "SLASH_GT",
    "LT_SLASH",
    "IDENT",
    "GT",
    "EOF",
  ])
})

// opening === closing の場合に閉じタグの /closing を正しくトークナイズできることを確認する
test("tokenizer: same opening and closing delimiter with close tag", () => {
  const otPipe = new onlytag({ tags: [{ opening: "|", closing: "|" }] })
  const tokens = otPipe.tokenize("|Parent||Child /|| /Parent|")
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, [
    "LT",
    "IDENT",
    "GT",
    "LT",
    "IDENT",
    "SLASH_GT",
    "LT_SLASH",
    "IDENT",
    "GT",
    "EOF",
  ])
})

// カスタムデリミタで placeholder をトークナイズできることを確認する
test("tokenizer: custom delimiter with placeholder", () => {
  const otCustom = new onlytag({ tags: [{ opening: "|", closing: "|" }] })
  const tokens = otCustom.tokenize("|A attr=$myValue /|")
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, [
    "LT",
    "IDENT",
    "IDENT",
    "EQUALS",
    "PLACEHOLDER",
    "SLASH_GT",
    "EOF",
  ])
  assert.equal(tokens.find((t) => t.kind === "PLACEHOLDER")!.value, "$myValue")
})

// カスタムデリミタで JSON 値の境界を正しく検出することを確認する
test("tokenizer: custom delimiter json boundary detection", () => {
  const otCustom = new onlytag({ tags: [{ opening: "!", closing: "?" }] })
  const tokens = otCustom.tokenize('!A config={"k":1}/?')
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE")
  assert.equal(jsonToken!.value, '{"k":1}')
})

// --- pairIndex ---

// デリミタトークン（LT, LT_SLASH, GT, SLASH_GT）に pairIndex が付与されることを確認する
test("tokenizer: delimiter tokens have pairIndex", () => {
  const otMulti = new onlytag({
    tags: [
      { opening: "<", closing: ">" },
      { opening: "!", closing: "?" },
    ],
  })
  const tokens = otMulti.tokenize("<A />!B /?")

  const ltAngle = tokens.find((t) => t.kind === "LT" && t.value === "<")!
  assert.equal(ltAngle.pairIndex, 0)
  const slashGtAngle = tokens.find((t) => t.kind === "SLASH_GT" && t.value === "/>")!
  assert.equal(slashGtAngle.pairIndex, 0)

  const ltExcl = tokens.find((t) => t.kind === "LT" && t.value === "!")!
  assert.equal(ltExcl.pairIndex, 1)
  const slashGtQuest = tokens.find((t) => t.kind === "SLASH_GT" && t.value === "/?")!
  assert.equal(slashGtQuest.pairIndex, 1)
})

// 非デリミタトークン（IDENT, DOT_IDENT, EQUALS, JSON_VALUE, PLACEHOLDER, EOF）に pairIndex が付与されないことを確認する
test("tokenizer: non-delimiter tokens do not have pairIndex", () => {
  const tokens = ot.tokenize('<A .d attr="v" />')
  const nonDelimiterTokens = tokens.filter(
    (t) => !["LT", "LT_SLASH", "GT", "SLASH_GT"].includes(t.kind),
  )
  for (const token of nonDelimiterTokens) {
    assert.isUndefined(token.pairIndex)
  }
})

// 開閉タグの GT に pairIndex が付与されることを確認する
test("tokenizer: GT tokens have pairIndex", () => {
  const otMulti = new onlytag({
    tags: [
      { opening: "<", closing: ">" },
      { opening: "!", closing: "?" },
    ],
  })
  const tokens = otMulti.tokenize("<A>!B /?</A>")

  const gtTokens = tokens.filter((t) => t.kind === "GT")
  assert.equal(gtTokens[0].pairIndex, 0) // <A> の >
  assert.equal(gtTokens[1].pairIndex, 0) // </A> の >

  const ltSlash = tokens.find((t) => t.kind === "LT_SLASH")!
  assert.equal(ltSlash.pairIndex, 0)
})

// --- グループ値 ---

// グループ値を含む自己閉じタグのトークン列を確認する
test("tokenizer: group value with placeholder and json", () => {
  const tokens = ot.tokenize('<tag eq=($mode, "dark") />')
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, [
    "LT",
    "IDENT",
    "IDENT",
    "EQUALS",
    "LPAREN",
    "PLACEHOLDER",
    "COMMA",
    "JSON_VALUE",
    "RPAREN",
    "SLASH_GT",
    "EOF",
  ])
})

// グループ値内の複数 JSON 値をトークナイズできることを確認する
test("tokenizer: group value with multiple json values", () => {
  const tokens = ot.tokenize('<tag items=(1, "hello", true) />')
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, [
    "LT",
    "IDENT",
    "IDENT",
    "EQUALS",
    "LPAREN",
    "JSON_VALUE",
    "COMMA",
    "JSON_VALUE",
    "COMMA",
    "JSON_VALUE",
    "RPAREN",
    "SLASH_GT",
    "EOF",
  ])
  const jsonValues = tokens.filter((t) => t.kind === "JSON_VALUE").map((t) => t.value)
  assert.deepStrictEqual(jsonValues, ["1", '"hello"', "true"])
})

// グループ値内の複数 placeholder をトークナイズできることを確認する
test("tokenizer: group value with multiple placeholders", () => {
  const tokens = ot.tokenize("<tag items=($a, $b, $c) />")
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, [
    "LT",
    "IDENT",
    "IDENT",
    "EQUALS",
    "LPAREN",
    "PLACEHOLDER",
    "COMMA",
    "PLACEHOLDER",
    "COMMA",
    "PLACEHOLDER",
    "RPAREN",
    "SLASH_GT",
    "EOF",
  ])
})

// グループ値内の JSON オブジェクトと placeholder の混在をトークナイズできることを確認する
test("tokenizer: group value with json object and placeholder", () => {
  const tokens = ot.tokenize('<tag eq=({"a":1}, $ph) />')
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, [
    "LT",
    "IDENT",
    "IDENT",
    "EQUALS",
    "LPAREN",
    "JSON_VALUE",
    "COMMA",
    "PLACEHOLDER",
    "RPAREN",
    "SLASH_GT",
    "EOF",
  ])
  assert.equal(tokens.find((t) => t.kind === "JSON_VALUE")!.value, '{"a":1}')
})

// 空グループをトークナイズできることを確認する
test("tokenizer: empty group value", () => {
  const tokens = ot.tokenize("<tag key=() />")
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, [
    "LT",
    "IDENT",
    "IDENT",
    "EQUALS",
    "LPAREN",
    "RPAREN",
    "SLASH_GT",
    "EOF",
  ])
})

// グループ値と単値属性が共存するタグをトークナイズできることを確認する
test("tokenizer: group value and single value attributes coexist", () => {
  const tokens = ot.tokenize('<tag a="hello" b=($x, 42) c=true />')
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, [
    "LT",
    "IDENT",
    "IDENT",
    "EQUALS",
    "JSON_VALUE",
    "IDENT",
    "EQUALS",
    "LPAREN",
    "PLACEHOLDER",
    "COMMA",
    "JSON_VALUE",
    "RPAREN",
    "IDENT",
    "EQUALS",
    "JSON_VALUE",
    "SLASH_GT",
    "EOF",
  ])
})

// グループ値内の値の前後に空白があっても正しくトークナイズできることを確認する
test("tokenizer: group value with whitespace around values", () => {
  const tokens = ot.tokenize('<tag eq=( $mode , "dark" ) />')
  const kinds = tokens.map((t) => t.kind)
  assert.deepStrictEqual(kinds, [
    "LT",
    "IDENT",
    "IDENT",
    "EQUALS",
    "LPAREN",
    "PLACEHOLDER",
    "COMMA",
    "JSON_VALUE",
    "RPAREN",
    "SLASH_GT",
    "EOF",
  ])
})

// カスタムデリミタで < と > が通常文字扱いになりエラーとなることを確認する
test("tokenizer: angle brackets are invalid with custom-only delimiter", () => {
  const otCustom = new onlytag({ tags: [{ opening: "|", closing: "|" }] })
  let error: unknown
  try {
    otCustom.tokenize("<A />")
  } catch (caught) {
    error = caught
  }
  assert.instanceOf(error, Error)
})
