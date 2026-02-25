import { z } from "zod"

/**
 * 機能オプション。decoration と attribute の使用可否を設定する
 * @param allowDecorations - decoration（.name）の使用を許可するか。省略時は true
 * @param allowAttributes - attribute（key=value）の使用を許可するか。省略時は true
 */
export interface FeatureOptions {
  allowDecorations?: boolean
  allowAttributes?: boolean
}

/**
 * 正規化済み機能オプション。全フィールドが必須の boolean
 */
export interface NormalizedFeatureOptions {
  allowDecorations: boolean
  allowAttributes: boolean
}

/** NormalizedFeatureOptions の Zod スキーマ */
export const NormalizedFeatureOptionsSchema = z.object({
  allowDecorations: z.boolean(),
  allowAttributes: z.boolean(),
})

/**
 * FeatureOptions を正規化する。未指定フィールドはデフォルト値（true）で補完する
 * @param options - 正規化前のオプション。undefined の場合は全て許可
 * @returns 全フィールドが確定した NormalizedFeatureOptions
 */
export function normalizeFeatureOptions(options?: FeatureOptions): NormalizedFeatureOptions {
  return {
    allowDecorations: options?.allowDecorations ?? true,
    allowAttributes: options?.allowAttributes ?? true,
  }
}
