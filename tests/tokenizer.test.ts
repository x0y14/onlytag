import { test, assert } from "vitest";
import { tokenize } from "../src/tokenize.js";

// 自己閉じタグと文字列属性のトークン列を確認する
test("tokenizer: self-closing tag with string attribute", () => {
  const tokens = tokenize('<Title .primary text="Welcome to onlytag" />');
  const kinds = tokens.map((t) => t.kind);
  assert.deepStrictEqual(kinds, [
    "LT",
    "IDENT",
    "DOT_IDENT",
    "IDENT",
    "EQUALS",
    "JSON_VALUE",
    "SLASH_GT",
    "EOF",
  ]);
  assert.equal(tokens.find((t) => t.kind === "IDENT")!.value, "Title");
  assert.equal(tokens.find((t) => t.kind === "DOT_IDENT")!.value, ".primary");
  assert.equal(tokens.find((t) => t.kind === "JSON_VALUE")!.value, '"Welcome to onlytag"');
});

// 開始タグと終了タグのペアをトークン化できることを確認する
test("tokenizer: open and close tag pair", () => {
  const tokens = tokenize("<AppLayout></AppLayout>");
  const kinds = tokens.map((t) => t.kind);
  assert.deepStrictEqual(kinds, ["LT", "IDENT", "GT", "LT_SLASH", "IDENT", "GT", "EOF"]);
});

// 数値属性がJSON_VALUEとして取得できることを確認する
test("tokenizer: numeric attribute", () => {
  const tokens = tokenize("<Identity level=42 />");
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE");
  assert.equal(jsonToken!.value, "42");
});

// JSONオブジェクト属性がJSON_VALUEとして取得できることを確認する
test("tokenizer: json object attribute", () => {
  const tokens = tokenize('<Stats base={"hp": 1500, "mp": 800} />');
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE");
  assert.equal(jsonToken!.value, '{"hp": 1500, "mp": 800}');
});

// JSON配列属性がJSON_VALUEとして取得できることを確認する
test("tokenizer: json array attribute", () => {
  const tokens = tokenize("<Stats modifiers=[1.2, 0.9, 1.05] />");
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE");
  assert.equal(jsonToken!.value, "[1.2, 0.9, 1.05]");
});

// 真偽値属性がJSON_VALUEとして取得できることを確認する
test("tokenizer: boolean attribute", () => {
  const tokens = tokenize("<Payload success=true />");
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE");
  assert.equal(jsonToken!.value, "true");
});

// null属性がJSON_VALUEとして取得できることを確認する
test("tokenizer: null attribute", () => {
  const tokens = tokenize("<Skills passive=null />");
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE");
  assert.equal(jsonToken!.value, "null");
});

// 複数デコレーションを順序どおり取得できることを確認する
test("tokenizer: multiple decorations", () => {
  const tokens = tokenize("<Character .hero .rare_ssr />");
  const decos = tokens.filter((t) => t.kind === "DOT_IDENT");
  assert.equal(decos.length, 2);
  assert.equal(decos[0].value, ".hero");
  assert.equal(decos[1].value, ".rare_ssr");
});

// 空白差分がトークン列に影響しないことを確認する
test("tokenizer: ignores whitespace differences", () => {
  const compact = tokenize("<A .b c=1 />");
  const spaced = tokenize("<  A   .b   c=1   />");
  assert.deepStrictEqual(
    compact.map((t) => t.kind),
    spaced.map((t) => t.kind),
  );
  assert.deepStrictEqual(
    compact.map((t) => t.value),
    spaced.map((t) => t.value),
  );
});

// 空入力はEOFのみを返すことを確認する
test("tokenizer: empty input returns only eof", () => {
  const tokens = tokenize("");
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].kind, "EOF");
});

// ネストしたJSON配列属性をJSON_VALUEとして取得できることを確認する
test("tokenizer: nested json array attribute", () => {
  const tokens = tokenize(
    '<NavigationMenu items=[{"label": "Home", "href": "/"}, {"label": "Docs", "href": "/docs"}] />',
  );
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE");
  assert.equal(
    jsonToken!.value,
    '[{"label": "Home", "href": "/"}, {"label": "Docs", "href": "/docs"}]',
  );
});

// 識別子の許可文字を含むタグ名と属性名を取得できることを確認する
test("tokenizer: accepts allowed identifier characters", () => {
  const tokens = tokenize("<A_1-b c_2-d=1 />");
  const idents = tokens.filter((t) => t.kind === "IDENT").map((t) => t.value);
  assert.deepStrictEqual(idents, ["A_1-b", "c_2-d"]);
});

// デコレーション名の許可文字を取得できることを確認する
test("tokenizer: accepts allowed decoration characters", () => {
  const tokens = tokenize("<Card .x-1_y />");
  const deco = tokens.find((t) => t.kind === "DOT_IDENT");
  assert.equal(deco!.value, ".x-1_y");
});

// 文字列・数値・真偽値・null・配列・オブジェクト属性を順に取得できることを確認する
test("tokenizer: mixed json attribute values", () => {
  const tokens = tokenize('<A s="x" n=-1.25 b=false z=null arr=[1,2] obj={"k":"v"} />');
  const values = tokens.filter((t) => t.kind === "JSON_VALUE").map((t) => t.value);
  assert.deepStrictEqual(values, ['"x"', "-1.25", "false", "null", "[1,2]", '{"k":"v"}']);
});

// エスケープを含む文字列属性を正しく取得できることを確認する
test("tokenizer: escaped string attribute", () => {
  const tokens = tokenize('<A msg="a\\\"b\\\\c" />');
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE");
  assert.equal(jsonToken!.value, '"a\\\"b\\\\c"');
});

// READMEのAppLayout例先頭部をトークナイズできることを確認する
test("tokenizer: tokenizes README AppLayout prefix", () => {
  const input = `
    <AppLayout>
      <Header .fixed .glassmorphism>
        <NavigationMenu items=[{"label":"Home","href":"/"}] />
      </Header>
    </AppLayout>
  `;
  const tokens = tokenize(input);
  assert.equal(tokens[0].kind, "LT");
  assert.equal(tokens[tokens.length - 1].kind, "EOF");
  assert.isAtLeast(tokens.length, 10);
});
