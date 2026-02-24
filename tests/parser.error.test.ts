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
    assert.fail("missing parser error: expected=<Error>, actual=<no-throw>");
  }

  assert.instanceOf(error, Error);
  assert.match((error as Error).message, /position|pos|index|offset/i);
}

// 閉じタグ名が一致しない入力は失敗することを確認する
test("parser error: mismatched closing tag fails", () => {
  expectParserErrorWithPosition("<A></B>");
});

// 余分な閉じタグのみの入力は失敗することを確認する
test("parser error: stray closing tag fails", () => {
  expectParserErrorWithPosition("</A>");
});

// 閉じタグが欠落した入力は失敗することを確認する
test("parser error: missing closing tag fails", () => {
  expectParserErrorWithPosition("<A><B /></A");
});

// ネスト構造で閉じタグが不一致の入力は失敗することを確認する
test("parser error: nested closing tag mismatch fails", () => {
  expectParserErrorWithPosition("<A><B></A></B>");
});

// 自己閉じタグの後に余分な閉じタグがある入力は失敗することを確認する
test("parser error: extra close tag after self-closing element fails", () => {
  expectParserErrorWithPosition("<A /></A>");
});

// EOF到達時に閉じタグ不足なら失敗することを確認する
test("parser error: eof before closing tag fails", () => {
  expectParserErrorWithPosition("<A>");
});
