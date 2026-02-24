import type { Token } from "./token.js";
import type { DocumentNode } from "./ast.js";

export function tokenize(input: string): Token[] {
  throw new Error("not implemented");
}

export function parse(tokens: Token[]): DocumentNode {
  throw new Error("not implemented");
}
