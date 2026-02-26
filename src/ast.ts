import { z } from "zod"

/** デコレーション名のバリデーションパターン */
const DECORATION_NAME_PATTERN = /^[A-Za-z0-9_-]+$/
/** プレースホルダー名のバリデーションパターン */
const PLACEHOLDER_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9-]*$/
/** タグ名のスキーマバリデーションパターン */
const TAG_NAME_SCHEMA_PATTERN = /^[A-Za-z0-9_-]+$/

/** 任意のJSON値を受け付けるZodスキーマ */
export const JsonValueSchema = z.json()
/** 任意のJSON値を表す型 */
export type JsonValue = z.infer<typeof JsonValueSchema>

/** デコレーション（タグに付与される修飾子）のZodスキーマ */
export const DecorationSchema = z.object({
  name: z.string().regex(DECORATION_NAME_PATTERN),
})
/** デコレーションの型。英数字・ハイフン・アンダースコアからなる名前を持つ */
export type Decoration = z.infer<typeof DecorationSchema>

/** placeholder のZodスキーマ。属性値の右辺に出現する静的な文字列代替 */
export const PlaceholderSchema = z.object({
  type: z.literal("placeholder"),
  name: z.string().regex(PLACEHOLDER_NAME_PATTERN),
})
/** placeholder の型。$name 形式で指定される属性値代替 */
export type Placeholder = z.infer<typeof PlaceholderSchema>

/**
 * JSON値のうち、`type: "placeholder"` を持つオブジェクトを除外したスキーマ。
 * そのようなオブジェクトは PlaceholderSchema によってのみ受理される。
 */
const JsonNonPlaceholderValueSchema = JsonValueSchema.refine(
  (value) => !(value && typeof value === "object" && (value as any).type === "placeholder"),
  {
    message: 'Objects with type "placeholder" must satisfy PlaceholderSchema',
  },
)

/** 属性値のZodスキーマ。placeholder または JSON 値 */
export const AttributeValueSchema = z.union([PlaceholderSchema, JsonNonPlaceholderValueSchema])
/** 属性値の型。JSON 値または placeholder */
export type AttributeValue = Placeholder | JsonValue

/** 要素ノードの型。タグ名・デコレーション・属性・子要素を持つ */
export type ElementNode = {
  type: "element"
  tagName: string
  decorations: Decoration[]
  attributes: Record<string, AttributeValue>
  children: ElementNode[]
  selfClosing: boolean
}

/** 要素ノードの再帰的なZodスキーマ。子要素として自身を含むことができる */
export const ElementNodeSchema: z.ZodType<ElementNode> = z.lazy(() =>
  z.object({
    type: z.literal("element"),
    tagName: z.string().regex(TAG_NAME_SCHEMA_PATTERN),
    decorations: z.array(DecorationSchema),
    attributes: z.record(z.string(), AttributeValueSchema),
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
