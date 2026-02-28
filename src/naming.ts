/** tagname / decoration / attribute / placeholder で使用できる名前の先頭文字のバリデーションパターン */
export const NAME_FIRST_CHAR_PATTERN = /[a-zA-Z]/

/** tagname / decoration / attribute / placeholder で使用できる名前の後続文字のバリデーションパターン */
export const NAME_REST_CHAR_PATTERN = /[a-zA-Z0-9_-]/

/** tagname / decoration / attribute / placeholder で使用できる名前のバリデーションパターン */
export const NAME_PATTERN = new RegExp(
  `^${NAME_FIRST_CHAR_PATTERN.source}${NAME_REST_CHAR_PATTERN.source}*$`,
)

/**
* 文字列が名前（tagname / decoration / attribute / placeholder）の形式として有効かどうかを判定する
* @param name - 判定対象の文字列
* @returns 有効であればtrue
*/
export function isValidName(name: string): boolean {
  return NAME_PATTERN.test(name)
}
