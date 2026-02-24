import type { Token, TokenKind } from "./token.js";
import type { DocumentNode, ElementNode, Decoration, JsonValue } from "./ast.js";
import { z } from "zod";

// --- 内部ヘルパー ---

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function isIdentChar(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return (
    (c >= 65 && c <= 90) || // 英大文字
    (c >= 97 && c <= 122) || // 英小文字
    (c >= 48 && c <= 57) || // 数字
    c === 95 || // _
    c === 45 // -
  );
}

function tokenError(message: string, position: number): never {
  throw new Error(`${message}, position=${position}`);
}

function parseError(message: string, position: number): never {
  throw new Error(`${message}, position=${position}`);
}

const JsonValueCodec = z.codec(z.string(), z.json(), {
  decode: (jsonString, ctx) => {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "invalid json";
      ctx.issues.push({
        code: "invalid_format",
        format: "json",
        input: jsonString,
        message: detail,
      });
      return z.NEVER;
    }
  },
  encode: (value) => JSON.stringify(value),
});

function isJsonBoundary(input: string, end: number): boolean {
  const len = input.length;
  if (end >= len) return true;
  const ch = input[end];
  if (isWhitespace(ch) || ch === ">") return true;
  if (ch === "/" && end + 1 < len && input[end + 1] === ">") return true;
  return false;
}

function canStartJsonValue(ch: string): boolean {
  return (
    ch === '"' ||
    ch === "{" ||
    ch === "[" ||
    ch === "-" ||
    (ch >= "0" && ch <= "9") ||
    ch === "t" ||
    ch === "f" ||
    ch === "n"
  );
}

function readLiteralPreview(input: string, pos: number): string {
  const len = input.length;
  let i = pos;
  while (i < len) {
    const ch = input[i];
    if (isWhitespace(ch) || ch === "<" || ch === ">" || ch === "/" || ch === "=") break;
    i++;
  }
  if (i === pos) return "<eof>";
  return input.slice(pos, i);
}

function readJsonValue(input: string, pos: number): [value: string, newPos: number] {
  const len = input.length;

  // 属性値の前にある空白を読み飛ばす
  while (pos < len && isWhitespace(input[pos])) pos++;

  if (pos >= len) {
    tokenError("missing attribute value: expected=<json-value>, actual=<eof>", pos);
  }

  if (isJsonBoundary(input, pos)) {
    const actual = input[pos] === "/" ? "/>" : input[pos];
    tokenError(`missing attribute value: expected=<json-value>, actual=<${actual}>`, pos);
  }

  if (!canStartJsonValue(input[pos])) {
    tokenError(`invalid json value start: expected=<json-start>, actual=<${input[pos]}>`, pos);
  }

  let lastDecodeIssue = "invalid json";
  for (let end = pos + 1; end <= len; end++) {
    if (!isJsonBoundary(input, end)) continue;
    const candidate = input.slice(pos, end);
    const result = JsonValueCodec.safeDecode(candidate);
    if (result.success) {
      return [candidate, end];
    }
    lastDecodeIssue = result.error.issues[0]?.message ?? "invalid json";
  }

  tokenError(
    `invalid json attribute value: expected=<valid-json>, actual=<${readLiteralPreview(input, pos)}>, detail=<${lastDecodeIssue}>`,
    pos,
  );
}

// --- 公開API ---

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const len = input.length;
  let pos = 0;
  let lastKind: TokenKind | null = null;

  function emit(kind: TokenKind, value: string, position: number) {
    tokens.push({ kind, value, position });
    lastKind = kind;
  }

  while (true) {
    // 空白を読み飛ばす
    while (pos < len && isWhitespace(input[pos])) pos++;

    // EQUALS の直後は JSON 値として読む
    if (lastKind === "EQUALS") {
      const start = pos;
      const [value, newPos] = readJsonValue(input, pos);
      emit("JSON_VALUE", value, start);
      pos = newPos;
      continue;
    }

    if (pos >= len) break;

    const start = pos;

    const ch = input[pos];

    switch (ch) {
      case "<":
        if (pos + 1 < len && input[pos + 1] === "/") {
          emit("LT_SLASH", "</", start);
          pos += 2;
        } else {
          emit("LT", "<", start);
          pos += 1;
        }
        break;

      case ">":
        emit("GT", ">", start);
        pos += 1;
        break;

      case "/":
        if (pos + 1 < len && input[pos + 1] === ">") {
          emit("SLASH_GT", "/>", start);
          pos += 2;
        } else {
          const next = pos + 1 < len ? input[pos + 1] : "<eof>";
          tokenError(`invalid slash token: expected=</>, actual=</${next}>`, pos);
        }
        break;

      case "=":
        emit("EQUALS", "=", start);
        pos += 1;
        break;

      case ".":
        pos += 1;
        if (pos < len && isIdentChar(input[pos])) {
          const identStart = pos;
          while (pos < len && isIdentChar(input[pos])) pos++;
          emit("DOT_IDENT", "." + input.slice(identStart, pos), start);
        } else {
          const actual = pos < len ? `.${input[pos]}` : ".<eof>";
          tokenError(
            `invalid decoration token: expected=<.[A-Za-z0-9_-]+>, actual=<${actual}>`,
            start,
          );
        }
        break;

      default:
        if (isIdentChar(ch)) {
          while (pos < len && isIdentChar(input[pos])) pos++;
          emit("IDENT", input.slice(start, pos), start);
        } else {
          tokenError(
            `invalid token character: expected=<identifier|syntax-token>, actual=<${ch}>`,
            pos,
          );
        }
        break;
    }
  }

  tokens.push({ kind: "EOF", value: "", position: pos });
  return tokens;
}

export function parse(tokens: Token[]): DocumentNode {
  const cursor = { value: 0 };

  function peek(): Token {
    return tokens[cursor.value];
  }

  function advance(): Token {
    return tokens[cursor.value++];
  }

  function expect(kind: TokenKind): Token {
    const tok = peek();
    if (tok.kind !== kind) {
      parseError(
        `unexpected token: expected=<${kind}>, actual=<${tok.kind}>, value="${tok.value}"`,
        tok.position,
      );
    }
    return advance();
  }

  function parseElement(): ElementNode {
    expect("LT");
    const tagToken = expect("IDENT");
    const tagName = tagToken.value;

    // デコレーション
    const decorations: Decoration[] = [];
    while (peek().kind === "DOT_IDENT") {
      const deco = advance();
      decorations.push({ name: deco.value.slice(1) }); // 先頭のドットを除去する
    }

    // 属性
    const attributes: Record<string, JsonValue> = {};
    while (peek().kind === "IDENT") {
      const attrName = advance().value;
      expect("EQUALS");
      const jsonToken = expect("JSON_VALUE");
      const parsed = JsonValueCodec.safeDecode(jsonToken.value);
      if (!parsed.success) {
        const detail = parsed.error.issues[0]?.message ?? "invalid json";
        parseError(
          `invalid json attribute: expected=<valid-json>, actual=<${jsonToken.value}>, attr=<${attrName}>, detail=<${detail}>`,
          jsonToken.position,
        );
      }
      // codecの双方向契約を維持するため、再エンコード可能であることを確認する
      JsonValueCodec.encode(parsed.data as JsonValue);
      attributes[attrName] = parsed.data as JsonValue;
    }

    // 自己閉じ
    if (peek().kind === "SLASH_GT") {
      advance();
      return {
        type: "element",
        tagName,
        decorations,
        attributes,
        children: [],
        selfClosing: true,
      };
    }

    expect("GT");

    // 子要素
    const children: ElementNode[] = [];
    while (peek().kind === "LT") {
      children.push(parseElement());
    }

    // 閉じタグ
    if (peek().kind === "EOF") {
      parseError(`missing closing tag: expected=</${tagName}>, actual=<eof>`, peek().position);
    }

    expect("LT_SLASH");
    const closeTag = expect("IDENT");
    if (closeTag.value !== tagName) {
      parseError(
        `mismatched closing tag: expected=</${tagName}>, actual=</${closeTag.value}>`,
        closeTag.position,
      );
    }
    expect("GT");

    return {
      type: "element",
      tagName,
      decorations,
      attributes,
      children,
      selfClosing: false,
    };
  }

  function parseDocument(): DocumentNode {
    const children: ElementNode[] = [];
    while (peek().kind !== "EOF") {
      if (peek().kind === "LT_SLASH") {
        parseError(
          `unexpected closing tag at document root: expected=<element>, actual=<${peek().kind}>`,
          peek().position,
        );
      }
      children.push(parseElement());
    }
    return { type: "document", children };
  }

  return parseDocument();
}
