import { z } from "zod"

/** 任意のJSON値を受け付けるZodスキーマ */
export const JsonValueSchema = z.json()
/** 任意のJSON値を表す型 */
export type JsonValue = z.infer<typeof JsonValueSchema>

/** 変数（タグに付与される$修飾子）のZodスキーマ */
export const VariableSchema = z.object({
  name: z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]*$/),
})
/** 変数の型。英字始まりで英数字・ハイフンからなる名前を持つ */
export type Variable = z.infer<typeof VariableSchema>

/** デコレーション（タグに付与される修飾子）のZodスキーマ */
export const DecorationSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9_-]+$/),
})
/** デコレーションの型。英数字・ハイフン・アンダースコアからなる名前を持つ */
export type Decoration = z.infer<typeof DecorationSchema>

/** 要素ノードの型。タグ名・デコレーション・変数・属性・子要素を持つ */
export type ElementNode = {
  type: "element"
  tagName: string
  decorations: Decoration[]
  variables: Variable[]
  attributes: Record<string, JsonValue>
  children: ElementNode[]
  selfClosing: boolean
}

/** 要素ノードの再帰的なZodスキーマ。子要素として自身を含むことができる */
export const ElementNodeSchema: z.ZodType<ElementNode> = z.lazy(() =>
  z.object({
    type: z.literal("element"),
    tagName: z.string().regex(/^[A-Za-z0-9_-]+$/),
    decorations: z.array(DecorationSchema),
    variables: z.array(VariableSchema).default([]),
    attributes: z.record(z.string(), JsonValueSchema),
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
