import { z } from "zod"
import type { JsonValue } from "./ast.js"

/**
 * JSON文字列とJSON値を相互変換するcodec
 * decode時はJSON.parse失敗をZod issueとして扱う
 */
const JsonValueCodec = z.codec(z.string(), z.json(), {
  decode: (jsonString, ctx) => {
    try {
      return JSON.parse(jsonString)
    } catch (error) {
      const detail = error instanceof Error ? error.message : "invalid json"
      ctx.issues.push({
        code: "invalid_format",
        format: "json",
        input: jsonString,
        message: detail,
      })
      return z.NEVER
    }
  },
  encode: (value) => JSON.stringify(value),
})

/**
 * JSON文字列を安全にデコードする
 * @param jsonText - デコード対象のJSON文字列
 * @returns codecのsafeDecode結果
 */
export function decodeJsonString(jsonText: string) {
  return JsonValueCodec.safeDecode(jsonText)
}

/**
 * JSON値を文字列にエンコードする
 * @param value - エンコード対象のJSON値
 * @returns JSON文字列
 */
export function encodeJsonValue(value: JsonValue): string {
  return JsonValueCodec.encode(value)
}
