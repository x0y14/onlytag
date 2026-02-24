import type { Token, TokenKind } from "./token.js";
import type { DocumentNode, ElementNode, Decoration, JsonValue } from "./ast.js";

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

  const ch = input[pos];

  // 文字列
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
    tokenError("unterminated string literal: expected=<closing-quote>, actual=<eof>", pos);
  }

  // オブジェクトまたは配列
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
        else if (c === "{" && open === "[") {
          // 配列中のオブジェクトを許容するため、ここでは何もしない
        }
      }
      i++;
    }
    if (depth !== 0) {
      tokenError(`unterminated json structure: expected=<${close}>, actual=<eof>`, pos);
    }
    return [input.slice(pos, i), i];
  }

  // 数値（先頭が数字または-）
  if (ch === "-" || (ch >= "0" && ch <= "9")) {
    let i = pos;
    while (i < len && /[0-9.eE+-]/.test(input[i])) i++;
    return [input.slice(pos, i), i];
  }

  // trueリテラル
  if (ch === "t") {
    if (input.slice(pos, pos + 4) === "true") {
      return ["true", pos + 4];
    }
    tokenError(
      `invalid json literal: expected=<true>, actual=<${readLiteralPreview(input, pos)}>`,
      pos,
    );
  }

  // falseリテラル
  if (ch === "f") {
    if (input.slice(pos, pos + 5) === "false") {
      return ["false", pos + 5];
    }
    tokenError(
      `invalid json literal: expected=<false>, actual=<${readLiteralPreview(input, pos)}>`,
      pos,
    );
  }

  // nullリテラル
  if (ch === "n") {
    if (input.slice(pos, pos + 4) === "null") {
      return ["null", pos + 4];
    }
    tokenError(
      `invalid json literal: expected=<null>, actual=<${readLiteralPreview(input, pos)}>`,
      pos,
    );
  }

  tokenError(`missing attribute value: expected=<json-value>, actual=<${ch}>`, pos);
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
      attributes[attrName] = JSON.parse(jsonToken.value);
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
