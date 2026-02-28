import { type NormalizedOptions } from "../src/types.js"

const defaultTags = [{ opening: "<", closing: ">" }] as const

/**
 * 全ての正規化済みオプション組み合わせを返す
 *
 * allowMixedDelimiters, allowInconsistentClosures, allowGroup は常に true で固定している。
 * マトリックステストの入力はデリミタ 1 種類かつ閉じ方の混在がないため、
 * false にしても通るコードパスが変わらない。
 * false 時のエラー系パスは parser.error.test.ts や options.matrix.test.ts の専用テストでカバーしている。
 */
export function getAllNormalizedOptions(): NormalizedOptions[] {
  return [
    {
      allowDecorations: true,
      allowAttributes: true,
      allowPlaceholders: true,
      allowGroup: true,
      allowMixedDelimiters: true,
      allowInconsistentClosures: true,
      tags: [...defaultTags],
      maxNestingDepth: 1024,
    },
    {
      allowDecorations: true,
      allowAttributes: true,
      allowPlaceholders: false,
      allowGroup: true,
      allowMixedDelimiters: true,
      allowInconsistentClosures: true,
      tags: [...defaultTags],
      maxNestingDepth: 1024,
    },
    {
      allowDecorations: true,
      allowAttributes: false,
      allowPlaceholders: true,
      allowGroup: true,
      allowMixedDelimiters: true,
      allowInconsistentClosures: true,
      tags: [...defaultTags],
      maxNestingDepth: 1024,
    },
    {
      allowDecorations: true,
      allowAttributes: false,
      allowPlaceholders: false,
      allowGroup: true,
      allowMixedDelimiters: true,
      allowInconsistentClosures: true,
      tags: [...defaultTags],
      maxNestingDepth: 1024,
    },
    {
      allowDecorations: false,
      allowAttributes: true,
      allowPlaceholders: true,
      allowGroup: true,
      allowMixedDelimiters: true,
      allowInconsistentClosures: true,
      tags: [...defaultTags],
      maxNestingDepth: 1024,
    },
    {
      allowDecorations: false,
      allowAttributes: true,
      allowPlaceholders: false,
      allowGroup: true,
      allowMixedDelimiters: true,
      allowInconsistentClosures: true,
      tags: [...defaultTags],
      maxNestingDepth: 1024,
    },
    {
      allowDecorations: false,
      allowAttributes: false,
      allowPlaceholders: true,
      allowGroup: true,
      allowMixedDelimiters: true,
      allowInconsistentClosures: true,
      tags: [...defaultTags],
      maxNestingDepth: 1024,
    },
    {
      allowDecorations: false,
      allowAttributes: false,
      allowPlaceholders: false,
      allowGroup: true,
      allowMixedDelimiters: true,
      allowInconsistentClosures: true,
      tags: [...defaultTags],
      maxNestingDepth: 1024,
    },
  ]
}

/** 入力カテゴリの判定用 */
export type InputCategory = "A" | "B" | "C" | "D" | "E" | "F" | "G"

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
    case "E":
      return options.allowAttributes && options.allowPlaceholders
    case "F":
      return options.allowAttributes && options.allowPlaceholders && options.allowGroup
    case "G":
      return options.allowAttributes && options.allowGroup
  }
}
