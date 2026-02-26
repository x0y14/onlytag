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

/** インジェクトノード（$variable）のZodスキーマ */
export const InjectNodeSchema = z.object({
  type: z.literal("inject"),
  name: z.string().regex(/^[A-Za-z][A-Za-z0-9-]*$/),
})
/** インジェクトノードの型。$variable 参照を表す */
export type InjectNode = z.infer<typeof InjectNodeSchema>

/** ロジックノードの型。funcname(args) 関数呼び出しを表す */
export type LogicNode = {
  type: "logic"
  name: string
  args: LogicArg[]
}

/** ロジック引数の型。JSON値・インジェクト・ネストしたロジックのいずれか */
export type LogicArg = JsonValue | InjectNode | LogicNode

/** ロジック引数のZodスキーマ（再帰参照のためlazy） */
export const LogicArgSchema: z.ZodType<LogicArg> = z.lazy(() =>
  z.union([InjectNodeSchema, LogicNodeSchema, JsonValueSchema]),
)

/** ロジックノードの再帰的なZodスキーマ */
export const LogicNodeSchema: z.ZodType<LogicNode> = z.lazy(() =>
  z.object({
    type: z.literal("logic"),
    name: z.string().regex(/^[A-Za-z][A-Za-z0-9-]*$/),
    args: z.array(LogicArgSchema),
  }),
)

/** 属性値の型。JSON値・インジェクト・ロジックのいずれか */
export type AttributeValue = JsonValue | InjectNode | LogicNode

/** 属性値のZodスキーマ */
export const AttributeValueSchema: z.ZodType<AttributeValue> = z.lazy(() =>
  z.union([InjectNodeSchema, LogicNodeSchema, JsonValueSchema]),
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
