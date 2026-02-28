export const NAME_FORMAT = "[a-zA-Z][a-zA-Z0-9_-]*"

/** tagname / decoration / attribute / placeholder で使用できる名前の先頭文字のバリデーションパターン */
export const NAME_FIRST_CHAR_PATTERN = /^[a-zA-Z]$/

/** tagname / decoration / attribute / placeholder で使用できる名前の後続文字のバリデーションパターン */
export const NAME_REST_CHAR_PATTERN = /^[a-zA-Z0-9_-]$/

/** tagname / decoration / attribute / placeholder で使用できる名前のバリデーションパターン */
export const NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/

/**
* 文字列が名前（tagname / decoration / attribute / placeholder）の形式として有効かどうかを判定する
* @param name - 判定対象の文字列
* @returns 有効であればtrue
*/
export function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name)
}
