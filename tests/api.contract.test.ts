import { test, assert } from "vitest";
import * as onlytag from "../src/index.js";

test("公開API: 必須エクスポートが存在する", () => {
  assert.isFunction(onlytag.tokenize);
  assert.isFunction(onlytag.parse);
  assert.isDefined(onlytag.TokenSchema);
  assert.isDefined(onlytag.TokenKind);
  assert.isDefined(onlytag.JsonValueSchema);
  assert.isDefined(onlytag.DecorationSchema);
  assert.isDefined(onlytag.ElementNodeSchema);
  assert.isDefined(onlytag.DocumentNodeSchema);
});

test("公開API: tokenize(空文字列)は EOF を返す", () => {
  const tokens = onlytag.tokenize("");
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].kind, "EOF");
});

test("公開API: parse は document ノードを返す", () => {
  const tokens = onlytag.tokenize("<A />");
  const doc = onlytag.parse(tokens);
  assert.equal(doc.type, "document");
  assert.equal(doc.children.length, 1);
  assert.equal(doc.children[0].tagName, "A");
});

test("公開API: Schema は最小値を受理する", () => {
  const tokenResult = onlytag.TokenSchema.safeParse({
    kind: "EOF",
    value: "",
    position: 0,
  });
  assert.isTrue(tokenResult.success);

  const elementResult = onlytag.ElementNodeSchema.safeParse({
    type: "element",
    tagName: "A",
    decorations: [],
    attributes: {},
    children: [],
    selfClosing: true,
  });
  assert.isTrue(elementResult.success);
});
