import { test, assert } from "vitest";
import { tokenize, parse } from "../src/index.js";

function expectParserErrorWithPosition(input: string): void {
  let error: unknown;
  try {
    parse(tokenize(input));
  } catch (caught) {
    error = caught;
  }

  if (error === undefined) {
    assert.fail("parse は不正入力で Error を投げるべき");
  }

  assert.instanceOf(error, Error);
  assert.match((error as Error).message, /position|pos|index|offset/i);
}

test("閉じタグ不一致は失敗", () => {
  expectParserErrorWithPosition("<A></B>");
});

test("余分な閉じタグは失敗", () => {
  expectParserErrorWithPosition("</A>");
});

test("閉じタグ不足は失敗", () => {
  expectParserErrorWithPosition("<A><B /></A");
});

test("ネストした閉じタグ不一致は失敗", () => {
  expectParserErrorWithPosition("<A><B></A></B>");
});

test("自己閉じタグへの余分な閉じタグは失敗", () => {
  expectParserErrorWithPosition("<A /></A>");
});
