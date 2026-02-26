import { z } from "zod"

/** デリミタとして許可される文字の集合 */
export const ALLOWED_DELIMITER_CHARS: ReadonlySet<string> = new Set([
  "!", "#", "%", "&", "(", ")", "*", "+", ";", "<", ">", "?", "@", "^", "|", "~",
])

/**
 * タグデリミタのペア。開始文字と終了文字の組み合わせ
 * @param opening - 開始デリミタ（1文字）
 * @param closing - 終了デリミタ（1文字）
 */
export interface TagDelimiterPair {
  opening: string
  closing: string
}

/** TagDelimiterPair の Zod スキーマ */
export const TagDelimiterPairSchema = z.object({
  opening: z.string().length(1),
  closing: z.string().length(1),
})

/**
 * 機能オプション。decoration・attribute・placeholder の使用可否を設定する
 * @param allowDecorations - decoration（.name）の使用を許可するか。省略時は true
 * @param allowAttributes - attribute（key=value）の使用を許可するか。省略時は true
 * @param allowPlaceholders - placeholder（key=$name）の使用を許可するか。省略時は true
 * @param tags - デリミタペアの配列。省略時は [{opening: "<", closing: ">"}]
 */
export interface Options {
  allowDecorations?: boolean
  allowAttributes?: boolean
  allowPlaceholders?: boolean
  tags?: TagDelimiterPair[]
}

/**
 * 正規化済み機能オプション。全フィールドが必須
 */
export interface NormalizedOptions {
  allowDecorations: boolean
  allowAttributes: boolean
  allowPlaceholders: boolean
  tags: TagDelimiterPair[]
}

/** NormalizedOptions の Zod スキーマ */
export const NormalizedOptionsSchema = z.object({
  allowDecorations: z.boolean(),
  allowAttributes: z.boolean(),
  allowPlaceholders: z.boolean(),
  tags: z.array(TagDelimiterPairSchema).min(1),
}).superRefine((data, ctx) => {
  try {
    validateTags(data.tags)
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: (error as Error).message,
      path: ["tags"],
    })
  }
})

/** デフォルトのデリミタペア */
const DEFAULT_TAGS: TagDelimiterPair[] = [{ opening: "<", closing: ">" }]

/**
 * デリミタペア配列をバリデーションする
 * @param tags - バリデーション対象のデリミタペア配列
 * @throws {Error} バリデーションに失敗した場合
 */
function validateTags(tags: TagDelimiterPair[]): void {
  if (tags.length === 0) {
    throw new Error("tags must not be empty")
  }

  const seen = new Map<string, number>()

  for (let pairIndex = 0; pairIndex < tags.length; pairIndex++) {
    const pair = tags[pairIndex]

    if (pair.opening.length !== 1) {
      throw new Error(
        `tags[${pairIndex}].opening must be exactly 1 character: actual=<${pair.opening}>`,
      )
    }
    if (pair.closing.length !== 1) {
      throw new Error(
        `tags[${pairIndex}].closing must be exactly 1 character: actual=<${pair.closing}>`,
      )
    }

    if (!ALLOWED_DELIMITER_CHARS.has(pair.opening)) {
      throw new Error(
        `tags[${pairIndex}].opening "${pair.opening}" is not in allowed delimiter characters`,
      )
    }
    if (!ALLOWED_DELIMITER_CHARS.has(pair.closing)) {
      throw new Error(
        `tags[${pairIndex}].closing "${pair.closing}" is not in allowed delimiter characters`,
      )
    }

    // 一意性チェック: 同一ペア内で opening === closing は許可
    // 異なるペア間での文字重複は禁止
    const openingExisting = seen.get(pair.opening)
    if (openingExisting !== undefined) {
      throw new Error(
        `duplicate delimiter character "${pair.opening}" in tags[${pairIndex}].opening (already used in tags[${openingExisting}])`,
      )
    }

    if (pair.opening === pair.closing) {
      // 同一文字ペアの場合、opening のみ登録
      seen.set(pair.opening, pairIndex)
    } else {
      seen.set(pair.opening, pairIndex)

      const closingExisting = seen.get(pair.closing)
      if (closingExisting !== undefined) {
        throw new Error(
          `duplicate delimiter character "${pair.closing}" in tags[${pairIndex}].closing (already used in tags[${closingExisting}])`,
        )
      }
      seen.set(pair.closing, pairIndex)
    }
  }
}

/**
 * Options を正規化する。未指定フィールドはデフォルト値で補完する
 * @param options - 正規化前のオプション。undefined の場合は全て許可
 * @returns 全フィールドが確定した NormalizedOptions
 * @throws {Error} tags のバリデーションに失敗した場合
 */
export function normalizeOptions(options?: Options): NormalizedOptions {
  const tags = options?.tags ?? DEFAULT_TAGS
  validateTags(tags)

  return {
    allowDecorations: options?.allowDecorations ?? true,
    allowAttributes: options?.allowAttributes ?? true,
    allowPlaceholders: options?.allowPlaceholders ?? true,
    tags: [...tags],
  }
}
