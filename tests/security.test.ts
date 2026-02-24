import { test, assert } from "vitest";
import { tokenize, parse } from "../src/index.js";

function assertControlledError(error: unknown): void {
  assert.instanceOf(error, Error);
  assert.match((error as Error).message, /position|pos|index|offset/i);
}

// 長大な不正入力でも制御されたErrorで終了することを確認する
test("security: long malformed input fails with controlled error", () => {
  const input = `<A ${"x".repeat(20_000)}!=1 />`;
  let error: unknown;
  try {
    parse(tokenize(input));
  } catch (caught) {
    error = caught;
  }
  if (error === undefined) {
    assert.fail("missing security error: expected=<Error>, actual=<no-throw>");
  }
  assertControlledError(error);
});

// 深いネスト入力でもハングしないことを確認する
test("security: deep nesting does not hang", () => {
  const depth = 250;
  const open = Array.from({ length: depth }, () => "<A>").join("");
  const close = Array.from({ length: depth }, () => "</A>").join("");
  const input = `${open}<Leaf />${close}`;

  const startedAt = Date.now();
  try {
    const doc = parse(tokenize(input));
    assert.equal(doc.children.length, 1);
  } catch (error) {
    assertControlledError(error);
  }
  const elapsed = Date.now() - startedAt;
  assert.isBelow(elapsed, 2000);
});

// JSON属性に__proto__を含めてもprototype pollutionが起きないことを確認する
test("security: __proto__ payload does not cause prototype pollution", () => {
  assert.isUndefined(({} as { polluted?: string }).polluted);

  const doc = parse(tokenize('<A payload={"__proto__":{"polluted":"yes"},"safe":1} />'));
  const payload = doc.children[0].attributes["payload"];
  assert.deepStrictEqual(payload, { safe: 1 });
  assert.isUndefined(({} as { polluted?: string }).polluted);
});

// HTML風のペイロードは単なる文字列として扱われることを確認する
test("security: html-like payload is treated as plain string", () => {
  const doc = parse(tokenize('<A content="</script><img src=x onerror=alert(1)>" />'));
  assert.equal(doc.children[0].attributes["content"], "</script><img src=x onerror=alert(1)>");
});
