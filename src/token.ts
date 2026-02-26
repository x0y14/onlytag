import { z } from "zod"

/** トークンの種別を表す列挙スキーマ */
export const TokenKind = z.enum([
  "LT", // <
  "LT_SLASH", // </
  "GT", // >
  "SLASH_GT", // />
  "IDENT", // タグ名・属性名
  "DOT_IDENT", // .デコレーション（ドット含む）
  "EQUALS", // =
  "JSON_VALUE", // JSON値の生文字列
  "DOLLAR_IDENT", // $変数（ドル記号含む）
  "EOF",
])
/** トークン種別の型 */
export type TokenKind = z.infer<typeof TokenKind>

/** トークンの構造を定義するZodスキーマ */
export const TokenSchema = z.object({
  kind: TokenKind,
  value: z.string(),
  position: z.number().int().nonnegative(),
})
/** トークンの型。種別・値・入力文字列中の位置を持つ */
export type Token = z.infer<typeof TokenSchema>
