import { test, assert } from "vitest";
import * as fc from "fast-check";
import { tokenize } from "../src/tokenize.js";

function hasPositionHint(message: string): boolean {
  return /position|pos|index|offset/i.test(message);
}

const identArb = fc.stringMatching(/^[A-Za-z0-9_-]{1,10}$/);
const jsonLiteralArb = fc.jsonValue().map((value) => JSON.stringify(value));

const selfClosingTagInputArb = fc
  .record({
    tag: identArb,
    decorations: fc.array(identArb, { maxLength: 2 }),
    attributes: fc.array(fc.tuple(identArb, jsonLiteralArb), { maxLength: 3 }),
  })
  .map(({ tag, decorations, attributes }) => {
    const parts: string[] = [`<${tag}`];
    for (const deco of decorations) parts.push(`.${deco}`);
    for (const [name, value] of attributes) parts.push(`${name}=${value}`);
    return `${parts.join(" ")} />`;
  });

test("tokenize: 任意文字列入力で無限ループせず、成功か規定エラーになる", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 120 }), (input) => {
      try {
        const tokens = tokenize(input);
        assert.isArray(tokens);
        assert.isAtLeast(tokens.length, 1);
        assert.equal(tokens[tokens.length - 1].kind, "EOF");
      } catch (error) {
        assert.instanceOf(error, Error);
        assert.isTrue(hasPositionHint((error as Error).message));
      }
    }),
    { numRuns: 300 },
  );
});

test("tokenize: 有効な自己閉じタグ生成入力は常に EOF で終わる", () => {
  fc.assert(
    fc.property(selfClosingTagInputArb, (input) => {
      const tokens = tokenize(input);
      assert.equal(tokens[0].kind, "LT");
      assert.equal(tokens[tokens.length - 1].kind, "EOF");
      assert.equal(tokens.find((token) => token.kind === "IDENT")?.value.length! > 0, true);
    }),
    { numRuns: 200 },
  );
});

test("tokenize: 空白差分はトークン列の kind/value を変えない", () => {
  fc.assert(
    fc.property(identArb, identArb, fc.integer({ min: -9, max: 9 }), (tag, attr, value) => {
      const compact = `<${tag} ${attr}=${value} />`;
      const spaced = `<  ${tag}   ${attr} = ${value}   />`;
      const compactTokens = tokenize(compact);
      const spacedTokens = tokenize(spaced);
      assert.deepStrictEqual(
        compactTokens.map((token) => token.kind),
        spacedTokens.map((token) => token.kind),
      );
      assert.deepStrictEqual(
        compactTokens.map((token) => token.value),
        spacedTokens.map((token) => token.value),
      );
    }),
    { numRuns: 200 },
  );
});
