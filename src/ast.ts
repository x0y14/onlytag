import { z } from "zod";

export const JsonValueSchema = z.json();
export type JsonValue = z.infer<typeof JsonValueSchema>;

export const DecorationSchema = z.object({
  name: z.string().regex(/^[A-Za-z0-9_-]+$/),
});
export type Decoration = z.infer<typeof DecorationSchema>;

export type ElementNode = {
  type: "element";
  tagName: string;
  decorations: Decoration[];
  attributes: Record<string, JsonValue>;
  children: ElementNode[];
  selfClosing: boolean;
};

export const ElementNodeSchema: z.ZodType<ElementNode> = z.lazy(() =>
  z.object({
    type: z.literal("element"),
    tagName: z.string().regex(/^[A-Za-z0-9_-]+$/),
    decorations: z.array(DecorationSchema),
    attributes: z.record(z.string(), JsonValueSchema),
    children: z.array(ElementNodeSchema),
    selfClosing: z.boolean(),
  }),
);

export const DocumentNodeSchema = z.object({
  type: z.literal("document"),
  children: z.array(ElementNodeSchema),
});
export type DocumentNode = z.infer<typeof DocumentNodeSchema>;
