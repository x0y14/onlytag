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

/** 変数ノード（$variable）のZodスキーマ */
export const VariableNodeSchema = z.object({
  type: z.literal("variable"),
  name: z.string().regex(/^[A-Za-z][A-Za-z0-9-]*$/),
})
/** 変数ノードの型。$variable 参照を表す */
export type VariableNode = z.infer<typeof VariableNodeSchema>

/** 関数ノードの型。funcname(args) 関数呼び出しを表す */
export type FunctionNode = {
  type: "function"
  name: string
  args: FunctionArg[]
}

/** 関数引数の型。JSON値・変数・ネストした関数のいずれか */
export type FunctionArg = JsonValue | VariableNode | FunctionNode

/** 関数引数のZodスキーマ（再帰参照のためlazy） */
export const FunctionArgSchema: z.ZodType<FunctionArg> = z.lazy(() =>
  z.union([VariableNodeSchema, FunctionNodeSchema, JsonValueSchema]),
)

/** 関数ノードの再帰的なZodスキーマ */
export const FunctionNodeSchema: z.ZodType<FunctionNode> = z.lazy(() =>
  z.object({
    type: z.literal("function"),
    name: z.string().regex(/^[A-Za-z][A-Za-z0-9-]*$/),
    args: z.array(FunctionArgSchema),
  }),
)

/** 属性値の型。JSON値・変数・関数のいずれか */
export type AttributeValue = JsonValue | VariableNode | FunctionNode

/** 属性値のZodスキーマ */
export const AttributeValueSchema: z.ZodType<AttributeValue> = z.lazy(() =>
  z.union([VariableNodeSchema, FunctionNodeSchema, JsonValueSchema]),
)

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
