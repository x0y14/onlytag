import { z } from "zod"

/**
 * タグの開始・終了デリミタを表す設定
 * @param opening - 開始デリミタ文字（例: "<"）
 * @param closing - 終了デリミタ文字（例: ">"）
 */
export interface TagConfig {
  opening: string
  closing: string
}

/**
 * 機能オプション。decoration と attribute の使用可否、タグデリミタを設定する
 * @param allowDecorations - decoration（.name）の使用を許可するか。省略時は true
 * @param allowAttributes - attribute（key=value）の使用を許可するか。省略時は true
 * @param tags - タグデリミタの設定リスト。省略時は [{ opening: "<", closing: ">" }]
 */
export interface Options {
  allowDecorations?: boolean
  allowAttributes?: boolean
  tags?: TagConfig[]
}

/**
 * 正規化済み機能オプション。全フィールドが必須
 */
export interface NormalizedOptions {
  allowDecorations: boolean
  allowAttributes: boolean
  tags: TagConfig[]
}

/**
 * タグデリミタとして使用できない予約済み文字かどうかを判定する
 * @param ch - 判定対象の1文字
 * @returns 無効なデリミタ文字であれば true
 */
function isReservedDelimChar(ch: string): boolean {
  if (ch.length !== 1) return true
  const c = ch.charCodeAt(0)
  if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57)) return true // [a-zA-Z0-9]
  if (c === 95 || c === 45) return true // _ -
  if (c === 46 || c === 61 || c === 34 || c === 47) return true // . = " /
  if (c === 32 || c === 9 || c === 10 || c === 13) return true // whitespace
  return false
}

/** TagConfig の Zod スキーマ */
export const TagConfigSchema = z.object({
  opening: z
    .string()
    .length(1)
    .refine((ch) => !isReservedDelimChar(ch), { message: "invalid opening delimiter character" }),
  closing: z
    .string()
    .length(1)
    .refine((ch) => !isReservedDelimChar(ch), { message: "invalid closing delimiter character" }),
})

/** NormalizedOptions の Zod スキーマ */
export const NormalizedOptionsSchema = z.object({
  allowDecorations: z.boolean(),
  allowAttributes: z.boolean(),
  tags: z.array(TagConfigSchema),
})

/** デフォルトのタグデリミタ設定 */
const DEFAULT_TAGS: TagConfig[] = [{ opening: "<", closing: ">" }]

/**
 * Options を正規化する。未指定フィールドはデフォルト値で補完し、タグデリミタを検証する
 * @param options - 正規化前のオプション。undefined の場合は全て許可
 * @returns 全フィールドが確定した NormalizedOptions
 * @throws {Error} タグデリミタに予約済み文字が使われている場合
 */
export function normalizeOptions(options?: Options): NormalizedOptions {
  const tags = options?.tags ?? DEFAULT_TAGS
  for (const tag of tags) {
    if (isReservedDelimChar(tag.opening)) {
      throw new Error(`invalid opening delimiter: "${tag.opening}"`)
    }
    if (isReservedDelimChar(tag.closing)) {
      throw new Error(`invalid closing delimiter: "${tag.closing}"`)
    }
  }
  return {
    allowDecorations: options?.allowDecorations ?? true,
    allowAttributes: options?.allowAttributes ?? true,
    tags,
  }
}
