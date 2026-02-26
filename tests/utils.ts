import { type NormalizedOptions } from "../src/types.js"

/**
 * 全ての正規化済みオプション組み合わせを返す
 */
export function getAllNormalizedOptions(): NormalizedOptions[] {
  return [
    { allowDecorations: true, allowAttributes: true, allowVariable: true, allowFunction: true },
    { allowDecorations: true, allowAttributes: false, allowVariable: true, allowFunction: true },
    { allowDecorations: false, allowAttributes: true, allowVariable: true, allowFunction: true },
    { allowDecorations: false, allowAttributes: false, allowVariable: true, allowFunction: true },
  ]
}

/** 入力カテゴリの判定用 */
export type InputCategory = "A" | "B" | "C" | "D"

/**
 * 指定カテゴリの入力が指定モードで成功すべきか判定する
 */
export function shouldPass(category: InputCategory, options: NormalizedOptions): boolean {
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
