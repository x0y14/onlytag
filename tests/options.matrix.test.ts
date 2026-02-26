import { test, assert } from "vitest"
import { onlytag } from "../src/onlytag.js"
import { getAllNormalizedOptions, shouldPass, type InputCategory } from "./utils.js"
import type { NormalizedOptions } from "../src/types.js"
import type { Token } from "../src/token.js"

/** カテゴリごとの代表入力 */
const representatives: Record<InputCategory, { label: string; input: string }[]> = {
  A: [
    { label: "自己閉じタグ", input: "<A />" },
    { label: "開閉タグ", input: "<A><B /></A>" },
    { label: "空入力", input: "" },
  ],
  B: [
    { label: "単一 decoration", input: "<A .primary />" },
    { label: "複数 decoration", input: "<Card .elevated .rounded_lg />" },
  ],
  C: [
    { label: "文字列属性", input: '<A name="Lumina" />' },
    { label: "数値属性", input: "<A level=42 />" },
    { label: "オブジェクト属性", input: '<A data={"hp":1500} />' },
  ],
  D: [
    { label: "decoration + 属性", input: '<Badge .primary label="new" />' },
    { label: "交互配置", input: "<Widget .d1 count=1 .d2 enabled=true />" },
  ],
  E: [
    { label: "placeholder 属性", input: "<A attr=$myValue />" },
    { label: "placeholder + JSON 属性", input: '<A ph=$abc json="x" />' },
  ],
}

/**
 * モードのラベルを生成する
 */
function modeLabel(options: NormalizedOptions): string {
  return `deco=${options.allowDecorations},attr=${options.allowAttributes},ph=${options.allowPlaceholders}`
}

for (const options of getAllNormalizedOptions()) {
  for (const category of ["A", "B", "C", "D", "E"] as InputCategory[]) {
    for (const { label, input } of representatives[category]) {
      const expectPass = shouldPass(category, options)
      const verb = expectPass ? "成功する" : "拒否する"

      test(`options matrix [${modeLabel(options)}]: カテゴリ${category} "${label}" を${verb}`, () => {
        const ot = new onlytag(options)

        if (expectPass) {
          const tokens = ot.tokenize(input)
          const document = ot.parse(tokens)
          assert.strictEqual(document.type, "document")
        } else {
          assert.throws(() => {
            const tokens = ot.tokenize(input)
            ot.parse(tokens)
          })
        }
      })
    }
  }
}

// --- 境界テスト ---

// decoration が先頭で即座に拒否されることを確認する
test("options boundary: decoration が先頭で即座に拒否される", () => {
  const ot = new onlytag({ allowDecorations: false, allowAttributes: true })
  assert.throws(() => {
    const tokens = ot.tokenize("<A .first x=1 />")
    ot.parse(tokens)
  })
})

// attribute が末尾にあっても拒否されることを確認する
test("options boundary: attribute が末尾にあっても拒否される", () => {
  const ot = new onlytag({ allowDecorations: true, allowAttributes: false })
  assert.throws(() => {
    const tokens = ot.tokenize("<A .ok last=1 />")
    ot.parse(tokens)
  })
})

// 両方禁止の場合は先に出現した要素でエラーになることを確認する
test("options boundary: 両方禁止の場合は先に出現した要素でエラー", () => {
  const ot = new onlytag({ allowDecorations: false, allowAttributes: false })
  assert.throws(() => {
    const tokens = ot.tokenize("<A .deco attr=1 />")
    ot.parse(tokens)
  })
})

// 子要素の禁止要素も拒否されることを確認する
test("options boundary: 子要素の禁止要素も拒否される", () => {
  const ot = new onlytag({ allowDecorations: false, allowAttributes: true })
  assert.throws(() => {
    const tokens = ot.tokenize("<Parent><Child .forbidden /></Parent>")
    ot.parse(tokens)
  })
})

// --- parse レベルのガードテスト ---
// tokenize を経由せず手動構築トークンを parse に直接渡して防御的ガードを検証する

test("parse guard: allowDecorations=false で DOT_IDENT トークンを渡すとエラー", () => {
  const ot = new onlytag({ allowDecorations: false, allowAttributes: true })
  const tokens: Token[] = [
    { kind: "LT", value: "<", position: 0 },
    { kind: "IDENT", value: "tag", position: 1 },
    { kind: "DOT_IDENT", value: ".deco", position: 4 },
    { kind: "SLASH_GT", value: "/>", position: 9 },
    { kind: "EOF", value: "", position: 11 },
  ]
  assert.throws(() => ot.parse(tokens), /decorations are not allowed/)
})

test("parse guard: allowAttributes=false で属性トークンを渡すとエラー", () => {
  const ot = new onlytag({ allowDecorations: true, allowAttributes: false })
  const tokens: Token[] = [
    { kind: "LT", value: "<", position: 0 },
    { kind: "IDENT", value: "tag", position: 1 },
    { kind: "IDENT", value: "attr", position: 5 },
    { kind: "EQUALS", value: "=", position: 9 },
    { kind: "JSON_VALUE", value: "42", position: 10 },
    { kind: "SLASH_GT", value: "/>", position: 12 },
    { kind: "EOF", value: "", position: 14 },
  ]
  assert.throws(() => ot.parse(tokens), /attributes are not allowed/)
})

test("parse guard: allowPlaceholders=false で PLACEHOLDER トークンを渡すとエラー", () => {
  const ot = new onlytag({ allowPlaceholders: false })
  const tokens: Token[] = [
    { kind: "LT", value: "<", position: 0 },
    { kind: "IDENT", value: "tag", position: 1 },
    { kind: "IDENT", value: "attr", position: 5 },
    { kind: "EQUALS", value: "=", position: 9 },
    { kind: "PLACEHOLDER", value: "$abc", position: 10 },
    { kind: "SLASH_GT", value: "/>", position: 14 },
    { kind: "EOF", value: "", position: 16 },
  ]
  assert.throws(() => ot.parse(tokens), /placeholders are not allowed/)
})
