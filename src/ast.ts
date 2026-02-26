import { z } from "zod"

/** 任意のJSON値を受け付けるZodスキーマ */
export const JsonValueSchema = z.json()
/** 任意のJSON値を表す型 */
export type JsonValue = z.infer<typeof JsonValueSchema>

/** デコレーション（タグに付与される修飾子）のZodスキーマ */
export const DecorationSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9_-]+$/),
})
/** デコレーションの型。英数字・ハイフン・アンダースコアからなる名前を持つ */
export type Decoration = z.infer<typeof DecorationSchema>

/** placeholder のZodスキーマ。属性値の右辺に出現する静的な文字列代替 */
export const PlaceholderSchema = z.object({
  type: z.literal("placeholder"),
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]*$/),
})
/** placeholder の型。$name 形式で指定される属性値代替 */
export type Placeholder = z.infer<typeof PlaceholderSchema>

/** 属性値のZodスキーマ。placeholder または JSON 値 */
export const AttributeValueSchema = z.union([PlaceholderSchema, JsonValueSchema])
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
