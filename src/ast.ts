import { z } from "zod"

/** 任意のJSON値を受け付けるZodスキーマ */
export const JsonValueSchema = z.json()
/** 任意のJSON値を表す型 */
export type JsonValue = z.infer<typeof JsonValueSchema>

/** プレースホルダーノードのZodスキーマ（$[a-zA-Z][0-9a-zA-Z-]*） */
export const PlaceholderNodeSchema = z.object({
  type: z.literal("placeholder"),
  name: z.string().regex(/^\$[a-zA-Z][0-9a-zA-Z-]*$/),
})
/** プレースホルダーノードの型。属性値として使用できる */
export type PlaceholderNode = z.infer<typeof PlaceholderNodeSchema>

/** デコレーション（タグに付与される修飾子）のZodスキーマ */
export const DecorationSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9_-]+$/),
})
/** デコレーションの型。英数字・ハイフン・アンダースコアからなる名前を持つ */
export type Decoration = z.infer<typeof DecorationSchema>

/** 属性値のZodスキーマ。JSONかプレースホルダーのいずれか */
export const AttributeValueSchema = z.union([JsonValueSchema, PlaceholderNodeSchema])
/** 属性値の型 */
export type AttributeValue = z.infer<typeof AttributeValueSchema>

/** 要素ノードの型。タグ名・デコレーション・属性・子要素を持つ */
export type ElementNode = {
  type: "element"
  tagName: string
  decorations: Decoration[]
  attributes: Record<string, JsonValue | PlaceholderNode>
  children: ElementNode[]
  selfClosing: boolean
}

/** 要素ノードの再帰的なZodスキーマ。子要素として自身を含むことができる */
export const ElementNodeSchema: z.ZodType<ElementNode> = z.lazy(() =>
  z.object({
    type: z.literal("element"),
    tagName: z.string().regex(/^[A-Za-z0-9_-]+$/),
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
