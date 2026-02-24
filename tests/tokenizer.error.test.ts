import { test, assert } from "vitest";
import { tokenize } from "../src/tokenize.js";

function expectTokenizerErrorWithPosition(input: string): void {
  let error: unknown;
  try {
    tokenize(input);
  } catch (caught) {
    error = caught;
  }

  if (error === undefined) {
    assert.fail("tokenize は不正入力で Error を投げるべき");
  }

  assert.instanceOf(error, Error);
  assert.match((error as Error).message, /position|pos|index|offset/i);
}

test("不正文字を含むタグ名は失敗", () => {
  expectTokenizerErrorWithPosition("<A@ />");
});

test("未終了の文字列属性は失敗", () => {
  expectTokenizerErrorWithPosition('<A name="Lumina />');
});

test("未終了のJSONオブジェクト属性は失敗", () => {
  expectTokenizerErrorWithPosition('<A data={"hp": 100 />');
});

test("属性値が欠落している場合は失敗", () => {
  expectTokenizerErrorWithPosition("<A level= />");
});

test("不正文字を含むdecorationは失敗", () => {
  expectTokenizerErrorWithPosition("<A .bad! />");
});
