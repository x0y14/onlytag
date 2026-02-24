import { test, assert } from "vitest";
import { tokenize } from "../src/tokenize.js";

test("自己閉じタグ + 文字列属性", () => {
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

test("開閉タグペア", () => {
  const tokens = tokenize("<AppLayout></AppLayout>");
  const kinds = tokens.map((t) => t.kind);
  assert.deepStrictEqual(kinds, ["LT", "IDENT", "GT", "LT_SLASH", "IDENT", "GT", "EOF"]);
});

test("数値属性", () => {
  const tokens = tokenize("<Identity level=42 />");
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE");
  assert.equal(jsonToken!.value, "42");
});

test("JSONオブジェクト属性", () => {
  const tokens = tokenize('<Stats base={"hp": 1500, "mp": 800} />');
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE");
  assert.equal(jsonToken!.value, '{"hp": 1500, "mp": 800}');
});

test("JSON配列属性", () => {
  const tokens = tokenize("<Stats modifiers=[1.2, 0.9, 1.05] />");
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE");
  assert.equal(jsonToken!.value, "[1.2, 0.9, 1.05]");
});

test("boolean属性", () => {
  const tokens = tokenize("<Payload success=true />");
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE");
  assert.equal(jsonToken!.value, "true");
});

test("null属性", () => {
  const tokens = tokenize("<Skills passive=null />");
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE");
  assert.equal(jsonToken!.value, "null");
});

test("複数decoration", () => {
  const tokens = tokenize("<Character .hero .rare_ssr />");
  const decos = tokens.filter((t) => t.kind === "DOT_IDENT");
  assert.equal(decos.length, 2);
  assert.equal(decos[0].value, ".hero");
  assert.equal(decos[1].value, ".rare_ssr");
});

test("空白の無視（トークン列が同一になること）", () => {
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

test("空入力 → EOFのみ", () => {
  const tokens = tokenize("");
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].kind, "EOF");
});

test("ネストされたJSON配列", () => {
  const tokens = tokenize(
    '<NavigationMenu items=[{"label": "Home", "href": "/"}, {"label": "Docs", "href": "/docs"}] />',
  );
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE");
  assert.equal(
    jsonToken!.value,
    '[{"label": "Home", "href": "/"}, {"label": "Docs", "href": "/docs"}]',
  );
});

test("識別子の許可文字（数字・英字・アンダースコア・ハイフン）", () => {
  const tokens = tokenize("<A_1-b c_2-d=1 />");
  const idents = tokens.filter((t) => t.kind === "IDENT").map((t) => t.value);
  assert.deepStrictEqual(idents, ["A_1-b", "c_2-d"]);
});

test("decorationの許可文字（数字・英字・アンダースコア・ハイフン）", () => {
  const tokens = tokenize("<Card .x-1_y />");
  const deco = tokens.find((t) => t.kind === "DOT_IDENT");
  assert.equal(deco!.value, ".x-1_y");
});

test("属性の複合JSON値（文字列, 数値, 真偽, null, 配列, オブジェクト）", () => {
  const tokens = tokenize('<A s="x" n=-1.25 b=false z=null arr=[1,2] obj={"k":"v"} />');
  const values = tokens.filter((t) => t.kind === "JSON_VALUE").map((t) => t.value);
  assert.deepStrictEqual(values, ['"x"', "-1.25", "false", "null", "[1,2]", '{"k":"v"}']);
});

test("エスケープを含む文字列属性", () => {
  const tokens = tokenize('<A msg="a\\\"b\\\\c" />');
  const jsonToken = tokens.find((t) => t.kind === "JSON_VALUE");
  assert.equal(jsonToken!.value, '"a\\\"b\\\\c"');
});

test("README AppLayout例の先頭部をトークナイズできる", () => {
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
