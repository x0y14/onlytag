import { test, assert } from "vitest";
import { tokenize, parse } from "../src/index.js";

function assertControlledError(error: unknown): void {
  assert.instanceOf(error, Error);
  assert.match((error as Error).message, /position|pos|index|offset/i);
}

test("長大な不正入力でも制御されたErrorで終了する", () => {
  const input = `<A ${"x".repeat(20_000)}!=1 />`;
  let error: unknown;
  try {
    parse(tokenize(input));
  } catch (caught) {
    error = caught;
  }
  if (error === undefined) {
    assert.fail("不正入力で Error が発生するべき");
  }
  assertControlledError(error);
});

test("深いネスト入力でもハングしない", () => {
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

test("JSON属性で __proto__ を与えても prototype pollution しない", () => {
  assert.isUndefined(({} as { polluted?: string }).polluted);

  const doc = parse(tokenize('<A payload={"__proto__":{"polluted":"yes"},"safe":1} />'));
  const payload = doc.children[0].attributes["payload"];
  assert.deepStrictEqual(payload, JSON.parse('{"__proto__":{"polluted":"yes"},"safe":1}'));
  assert.isUndefined(({} as { polluted?: string }).polluted);
});

test("HTML風ペイロードはただの文字列として扱う", () => {
  const doc = parse(tokenize('<A content="</script><img src=x onerror=alert(1)>" />'));
  assert.equal(doc.children[0].attributes["content"], "</script><img src=x onerror=alert(1)>");
});
