import { type NormalizedFeatureOptions } from "../src/types.js"
import { onlytag } from "../src/onlytag.js"

/**
 * 全ての正規化済みオプション組み合わせを返す
 */
export function getAllNormalizedFeatureOptions(): NormalizedFeatureOptions[] {
  return [
    { allowDecorations: true, allowAttributes: true },
    { allowDecorations: true, allowAttributes: false },
    { allowDecorations: false, allowAttributes: true },
    { allowDecorations: false, allowAttributes: false },
  ]
}

/**
 * 指定オプションで onlytag インスタンスを生成する
 */
export function createOnlytag(options?: NormalizedFeatureOptions): onlytag {
  return new onlytag(options)
}

/** 入力カテゴリの判定用 */
export type InputCategory = "A" | "B" | "C" | "D"

/**
 * 指定カテゴリの入力が指定モードで成功すべきか判定する
 */
export function shouldPass(category: InputCategory, options: NormalizedFeatureOptions): boolean {
  switch (category) {
    case "A":
      return true
    case "B":
      return options.allowDecorations
    case "C":
      return options.allowAttributes
    case "D":
      return options.allowDecorations && options.allowAttributes
  }
}
