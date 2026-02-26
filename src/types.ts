import { z } from "zod"

/**
 * 機能オプション。decoration・attribute・variable・function の使用可否を設定する
 * @param allowDecorations - decoration（.name）の使用を許可するか。省略時は true
 * @param allowAttributes - attribute（key=value）の使用を許可するか。省略時は true
 * @param allowVariable - variable（$variable）の属性値としての使用を許可するか。省略時は true
 * @param allowFunction - function（funcname(args)）の属性値としての使用を許可するか。省略時は true
 */
export interface Options {
  allowDecorations?: boolean
  allowAttributes?: boolean
  allowVariable?: boolean
  allowFunction?: boolean
}

/**
 * 正規化済み機能オプション。全フィールドが必須の boolean
 */
export interface NormalizedOptions {
  allowDecorations: boolean
  allowAttributes: boolean
  allowVariable: boolean
  allowFunction: boolean
}

/** NormalizedOptions の Zod スキーマ */
export const NormalizedOptionsSchema = z.object({
  allowDecorations: z.boolean(),
  allowAttributes: z.boolean(),
  allowVariable: z.boolean(),
  allowFunction: z.boolean(),
})

/**
 * Options を正規化する。未指定フィールドはデフォルト値（true）で補完する
 * @param options - 正規化前のオプション。undefined の場合は全て許可
 * @returns 全フィールドが確定した NormalizedOptions
 */
export function normalizeOptions(options?: Options): NormalizedOptions {
  return {
    allowDecorations: options?.allowDecorations ?? true,
    allowAttributes: options?.allowAttributes ?? true,
    allowVariable: options?.allowVariable ?? true,
    allowFunction: options?.allowFunction ?? true,
  }
}
