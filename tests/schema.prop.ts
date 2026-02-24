import { test, assert } from "vitest";
import * as fc from "fast-check";
import {
  JsonValueSchema,
  DecorationSchema,
  ElementNodeSchema,
  DocumentNodeSchema,
} from "../src/ast.js";
import { TokenSchema } from "../src/token.js";

// --- JsonValue ---

const jsonValueArb: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  value: fc.oneof(
    fc.string(),
    fc.double({ noNaN: true, noDefaultInfinity: true }),
    fc.integer(),
    fc.boolean(),
    fc.constant(null),
    fc.array(tie("value"), { maxLength: 3, size: "small" }),
    fc.dictionary(fc.string(), tie("value"), { maxKeys: 3, size: "small" }),
  ),
})).value;

test("JsonValueSchema: 有効なJSON値は常にバリデーション成功", () => {
  fc.assert(
    fc.property(jsonValueArb, (value) => {
      const result = JsonValueSchema.safeParse(value);
      assert.isTrue(result.success);
    }),
  );
});

test("JsonValueSchema: ネストされた配列・オブジェクトでもバリデーション成功", () => {
  const nestedArb = fc.letrec((tie) => ({
    value: fc.oneof(
      fc.string(),
      fc.integer(),
      fc.array(tie("value"), { minLength: 1, maxLength: 2, size: "small" }),
      fc.dictionary(fc.string(), tie("value"), { minKeys: 1, maxKeys: 2, size: "small" }),
    ),
  })).value;

  fc.assert(
    fc.property(nestedArb, (value) => {
      const result = JsonValueSchema.safeParse(value);
      assert.isTrue(result.success);
    }),
  );
});

// --- Decoration ---

const validDecorationNameArb = fc.stringMatching(/^[A-Za-z0-9_-]+$/);

test("DecorationSchema: 有効な名前は常にバリデーション成功", () => {
  fc.assert(
    fc.property(validDecorationNameArb, (name) => {
      const result = DecorationSchema.safeParse({ name });
      assert.isTrue(result.success);
    }),
  );
});

test("DecorationSchema: 空文字列はバリデーション失敗", () => {
  const result = DecorationSchema.safeParse({ name: "" });
  assert.isFalse(result.success);
});

test("DecorationSchema: 不正文字を含む名前はバリデーション失敗", () => {
  const invalidCharArb = fc.stringMatching(/^[A-Za-z0-9_-]*[^A-Za-z0-9_-]+[A-Za-z0-9_-]*$/);

  fc.assert(
    fc.property(invalidCharArb, (name) => {
      const result = DecorationSchema.safeParse({ name });
      assert.isFalse(result.success);
    }),
  );
});

// --- Token ---

const tokenKindValues = [
  "LT",
  "LT_SLASH",
  "GT",
  "SLASH_GT",
  "IDENT",
  "DOT_IDENT",
  "EQUALS",
  "JSON_VALUE",
  "EOF",
] as const;

test("TokenSchema: 有効なToken（正しいkind・非負position・任意value）はバリデーション成功", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...tokenKindValues),
      fc.nat(),
      fc.string(),
      (kind, position, value) => {
        const result = TokenSchema.safeParse({ kind, position, value });
        assert.isTrue(result.success);
      },
    ),
  );
});

test("TokenSchema: 負のpositionはバリデーション失敗", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...tokenKindValues),
      fc.integer({ max: -1 }),
      fc.string(),
      (kind, position, value) => {
        const result = TokenSchema.safeParse({ kind, position, value });
        assert.isFalse(result.success);
      },
    ),
  );
});

test("TokenSchema: 不正なkindはバリデーション失敗", () => {
  fc.assert(
    fc.property(
      fc.string().filter((s) => !(tokenKindValues as readonly string[]).includes(s)),
      fc.nat(),
      fc.string(),
      (kind, position, value) => {
        const result = TokenSchema.safeParse({ kind, position, value });
        assert.isFalse(result.success);
      },
    ),
  );
});

// --- ElementNode ---

const tagNameArb = fc.stringMatching(/^[A-Za-z0-9_-]+$/);

// letrec 内の再帰と組み合わせてもスタックオーバーフローしないよう、
// attributes の値はフラットなプリミティブのみにする
const flatJsonValueArb = fc.oneof(
  fc.string(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.boolean(),
  fc.constant(null),
);

const elementNodeArb: fc.Arbitrary<unknown> = fc.letrec((tie) => ({
  node: fc.record({
    type: fc.constant("element" as const),
    tagName: tagNameArb,
    decorations: fc.array(fc.record({ name: validDecorationNameArb }), { maxLength: 3 }),
    attributes: fc.dictionary(fc.string(), flatJsonValueArb, { maxKeys: 3 }),
    children: fc.array(tie("node"), { maxLength: 1, size: "small" }),
    selfClosing: fc.constant(false),
  }),
})).node;

const selfClosingElementNodeArb = fc.record({
  type: fc.constant("element" as const),
  tagName: tagNameArb,
  decorations: fc.array(fc.record({ name: validDecorationNameArb }), { maxLength: 3 }),
  attributes: fc.dictionary(fc.string(), flatJsonValueArb, { maxKeys: 3 }),
  children: fc.constant([] as unknown[]),
  selfClosing: fc.constant(true),
});

test("ElementNodeSchema: 有効なElementNodeはバリデーション成功", () => {
  fc.assert(
    fc.property(elementNodeArb, (node) => {
      const result = ElementNodeSchema.safeParse(node);
      assert.isTrue(result.success);
    }),
  );
});

test("ElementNodeSchema: selfClosing=trueでchildren空配列はバリデーション成功", () => {
  fc.assert(
    fc.property(selfClosingElementNodeArb, (node) => {
      const result = ElementNodeSchema.safeParse(node);
      assert.isTrue(result.success);
    }),
  );
});

// --- DocumentNode ---

test("DocumentNodeSchema: 有効なDocumentNodeはバリデーション成功", () => {
  const documentNodeArb = fc.record({
    type: fc.constant("document" as const),
    children: fc.array(elementNodeArb, { maxLength: 2, size: "small" }),
  });

  fc.assert(
    fc.property(documentNodeArb, (doc) => {
      const result = DocumentNodeSchema.safeParse(doc);
      assert.isTrue(result.success);
    }),
  );
});
