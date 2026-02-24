import type { Token, TokenKind } from "./token.js";
import type { DocumentNode, ElementNode, Decoration, JsonValue } from "./ast.js";
import { decodeJsonString, encodeJsonValue } from "./utils.js";

/**
 * パース時のエラーを送出する
 * @param message - エラーメッセージ
 * @param position - エラーが発生した入力文字列中の位置
 * @throws {Error} 常にエラーをスローする
 */
function parseError(message: string, position: number): never {
  throw new Error(`${message}, position=${position}`);
}

/**
 * トークン列をパースしてAST（ドキュメントノード）を生成する
 * @param tokens - tokenize関数で生成されたトークン列
 * @returns ASTのルートであるドキュメントノード
 * @throws {Error} 構文エラー（タグの不一致・予期しないトークン等）がある場合
 */
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
      const parsed = decodeJsonString(jsonToken.value);
      if (!parsed.success) {
        const detail = parsed.error.issues[0]!.message;
        parseError(
          `invalid json attribute: expected=<valid-json>, actual=<${jsonToken.value}>, attr=<${attrName}>, detail=<${detail}>`,
          jsonToken.position,
        );
      }
      // codecの双方向契約を維持するため、再エンコード可能であることを確認する
      encodeJsonValue(parsed.data as JsonValue);
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
