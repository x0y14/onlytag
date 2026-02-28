import { z } from "zod"
import { NAME_PATTERN } from "./naming.js"

/** 任意のJSON値を受け付けるZodスキーマ */
export const JsonValueSchema = z.json()
/** 任意のJSON値を表す型 */
export type JsonValue = z.infer<typeof JsonValueSchema>

/** デコレーション（タグに付与される修飾子）のZodスキーマ */
export const DecorationSchema = z.object({
  name: z.string().regex(NAME_PATTERN),
})
/** デコレーションの型。先頭が英字で、以降は英数字・ハイフン・アンダースコアからなる名前を持つ */
export type Decoration = z.infer<typeof DecorationSchema>

/** placeholder のZodスキーマ。属性値の右辺に出現する静的な文字列代替 */
export const PlaceholderSchema = z.object({
  type: z.literal("placeholder"),
  name: z.string().regex(NAME_PATTERN),
})
/** placeholder の型。$name 形式で指定される属性値代替 */
export type Placeholder = z.infer<typeof PlaceholderSchema>

/**
 * JSON値のうち、`type: "placeholder"` や `type: "group"` を持つオブジェクトを除外したスキーマ。
 * そのようなオブジェクトは PlaceholderSchema / GroupValueSchema によってのみ受理される。
 */
const JsonNonPlaceholderValueSchema = JsonValueSchema.refine(
  (value) => {
    if (!value || typeof value !== "object") return true
    const type = (value as any).type
    return type !== "placeholder" && type !== "group"
  },
  {
    message: 'Objects with type "placeholder" or "group" must satisfy their respective schemas',
  },
)

/** グループ値のスキーマ。複数の JSON/Placeholder を保持する */
export const GroupValueSchema = z.object({
  type: z.literal("group"),
  values: z.array(z.union([PlaceholderSchema, JsonNonPlaceholderValueSchema])),
})
/** グループ値の型。複数の JSON 値または placeholder をまとめて保持する */
export type GroupValue = z.infer<typeof GroupValueSchema>

/** 属性値のZodスキーマ。placeholder、グループ値、または JSON 値 */
export const AttributeValueSchema = z.union([
  PlaceholderSchema,
  GroupValueSchema,
  JsonNonPlaceholderValueSchema,
])
/** 属性値の型。JSON 値、placeholder、またはグループ値 */
export type AttributeValue = Placeholder | GroupValue | JsonValue

/** 要素ノードの型。タグ名・デコレーション・属性・子要素を持つ */
export type ElementNode = {
  type: "element"
  name: string
  decorations: Decoration[]
  attributes: Record<string, AttributeValue>
  children: ElementNode[]
  selfClosing: boolean
}

/** 要素ノードの再帰的なZodスキーマ。子要素として自身を含むことができる */
export const ElementNodeSchema: z.ZodType<ElementNode> = z.lazy(() =>
  z.object({
    type: z.literal("element"),
    name: z.string().regex(NAME_PATTERN),
    decorations: z.array(DecorationSchema),
    attributes: z.record(z.string().regex(NAME_PATTERN), AttributeValueSchema),
    children: z.array(ElementNodeSchema),
    selfClosing: z.boolean(),
  }),
)

/** ドキュメントノード（ASTのルート）のZodスキーマ */
export const DocumentNodeSchema = z.object({
  type: z.literal("document"),
  children: z.array(ElementNodeSchema),
})
/** ドキュメントノードの型。ASTのルートとして複数の要素ノードを子に持つ */
export type DocumentNode = z.infer<typeof DocumentNodeSchema>
