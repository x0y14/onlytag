import type { Token, TokenKind } from "./token.js";
import type { DocumentNode, ElementNode, Decoration, JsonValue } from "./ast.js";

// --- internal helpers ---

function isWhitespace(ch: string): boolean {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function isIdentChar(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return (
    (c >= 65 && c <= 90) || // A-Z
    (c >= 97 && c <= 122) || // a-z
    (c >= 48 && c <= 57) || // 0-9
    c === 95 || // _
    c === 45 // -
  );
}

function tokenError(message: string, position: number): never {
  throw new Error(`${message} (position: ${position})`);
}

function parseError(message: string, position: number): never {
  throw new Error(`${message} (position: ${position})`);
}

function readJsonValue(input: string, pos: number): [value: string, newPos: number] {
  const len = input.length;

  // skip whitespace before value
  while (pos < len && isWhitespace(input[pos])) pos++;

  if (pos >= len) {
    tokenError("属性値が欠落しています", pos);
  }

  const ch = input[pos];

  // string
  if (ch === '"') {
    let i = pos + 1;
    while (i < len) {
      if (input[i] === "\\") {
        i += 2;
        continue;
      }
      if (input[i] === '"') {
        return [input.slice(pos, i + 1), i + 1];
      }
      i++;
    }
    tokenError("未終了の文字列", pos);
  }

  // object or array
  if (ch === "{" || ch === "[") {
    const open = ch;
    const close = open === "{" ? "}" : "]";
    let depth = 1;
    let i = pos + 1;
    let inString = false;
    while (i < len && depth > 0) {
      const c = input[i];
      if (inString) {
        if (c === "\\") {
          i += 2;
          continue;
        }
        if (c === '"') inString = false;
      } else {
        if (c === '"') inString = true;
        else if (c === open) depth++;
        else if (c === close) depth--;
        // handle nested opposite brackets
        else if (c === "{" && open === "[") {
          // need to handle nested objects inside arrays and vice versa
        }
      }
      i++;
    }
    if (depth !== 0) {
      tokenError("未終了のJSON構造", pos);
    }
    return [input.slice(pos, i), i];
  }

  // number (starts with digit or -)
  if (ch === "-" || (ch >= "0" && ch <= "9")) {
    let i = pos;
    while (i < len && /[0-9.eE+-]/.test(input[i])) i++;
    return [input.slice(pos, i), i];
  }

  // true
  if (ch === "t") {
    if (input.slice(pos, pos + 4) === "true") {
      return ["true", pos + 4];
    }
    tokenError("不正なJSON値", pos);
  }

  // false
  if (ch === "f") {
    if (input.slice(pos, pos + 5) === "false") {
      return ["false", pos + 5];
    }
    tokenError("不正なJSON値", pos);
  }

  // null
  if (ch === "n") {
    if (input.slice(pos, pos + 4) === "null") {
      return ["null", pos + 4];
    }
    tokenError("不正なJSON値", pos);
  }

  tokenError("属性値が欠落しています", pos);
}

// --- public API ---

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
    // skip whitespace
    while (pos < len && isWhitespace(input[pos])) pos++;

    // after EQUALS, read JSON value
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
          tokenError("不正な文字 '/'", pos);
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
          tokenError("不正なdecoration", start);
        }
        break;

      default:
        if (isIdentChar(ch)) {
          while (pos < len && isIdentChar(input[pos])) pos++;
          emit("IDENT", input.slice(start, pos), start);
        } else {
          tokenError(`不正な文字 '${ch}'`, pos);
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
        `期待: ${kind}, 実際: ${tok.kind} ("${tok.value}")`,
        tok.position,
      );
    }
    return advance();
  }

  function parseElement(): ElementNode {
    expect("LT");
    const tagToken = expect("IDENT");
    const tagName = tagToken.value;

    // decorations
    const decorations: Decoration[] = [];
    while (peek().kind === "DOT_IDENT") {
      const deco = advance();
      decorations.push({ name: deco.value.slice(1) }); // remove leading "."
    }

    // attributes
    const attributes: Record<string, JsonValue> = {};
    while (peek().kind === "IDENT") {
      const attrName = advance().value;
      expect("EQUALS");
      const jsonToken = expect("JSON_VALUE");
      attributes[attrName] = JSON.parse(jsonToken.value);
    }

    // self-closing
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

    // children
    const children: ElementNode[] = [];
    while (peek().kind === "LT") {
      children.push(parseElement());
    }

    // closing tag
    if (peek().kind === "EOF") {
      parseError("閉じタグが不足しています", peek().position);
    }

    expect("LT_SLASH");
    const closeTag = expect("IDENT");
    if (closeTag.value !== tagName) {
      parseError(
        `閉じタグ不一致: 期待 "${tagName}", 実際 "${closeTag.value}"`,
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
        parseError("予期しない閉じタグ", peek().position);
      }
      children.push(parseElement());
    }
    return { type: "document", children };
  }

  return parseDocument();
}
