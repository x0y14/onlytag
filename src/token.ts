import { z } from "zod";

export const TokenKind = z.enum([
  "LT", // <
  "LT_SLASH", // </
  "GT", // >
  "SLASH_GT", // />
  "IDENT", // タグ名・属性名
  "DOT_IDENT", // .デコレーション（ドット含む）
  "EQUALS", // =
  "JSON_VALUE", // JSON値の生文字列
  "EOF",
]);
export type TokenKind = z.infer<typeof TokenKind>;

export const TokenSchema = z.object({
  kind: TokenKind,
  value: z.string(),
  position: z.number().int().nonnegative(),
});
export type Token = z.infer<typeof TokenSchema>;
