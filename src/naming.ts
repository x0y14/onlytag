/**
 * 名前（タグ名・デコレーション名・属性キー・プレースホルダー名）の
 * バリデーションに使用する共通定数。
 *
 * 全ての識別子は先頭が英字で、英数字・アンダースコア・ハイフンからなる:
 *   ^[a-zA-Z][a-zA-Z0-9_-]*$
 */

/** 名前の完全バリデーション用正規表現 */
export const NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/

/** 名前の先頭文字バリデーション用正規表現（1文字マッチ） */
export const NAME_FIRST_CHAR_PATTERN = /[a-zA-Z]/

/** 名前の後続文字バリデーション用正規表現（1文字マッチ） */
export const NAME_REST_CHAR_PATTERN = /[a-zA-Z0-9_-]/

/** エラーメッセージ用の名前フォーマット文字列 */
export const NAME_FORMAT = "[a-zA-Z][a-zA-Z0-9_-]*"
