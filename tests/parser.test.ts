import { test, assert } from "vitest"
import { onlytag } from "../src/onlytag.js"

const ot = new onlytag()

// 単一の自己閉じタグを解析できることを確認する
test("parser: parses single self-closing tag", () => {
  const doc = ot.parse(ot.tokenize("<Br />"))
  assert.equal(doc.type, "document")
  assert.equal(doc.children.length, 1)
  assert.equal(doc.children[0].tagName, "Br")
  assert.equal(doc.children[0].selfClosing, true)
  assert.equal(doc.children[0].children.length, 0)
})

// 空の開閉タグペアを解析できることを確認する
test("parser: parses empty open-close pair", () => {
  const doc = ot.parse(ot.tokenize("<Div></Div>"))
  assert.equal(doc.children.length, 1)
  assert.equal(doc.children[0].tagName, "Div")
  assert.equal(doc.children[0].selfClosing, false)
  assert.equal(doc.children[0].children.length, 0)
})

// 親子のネスト要素を解析できることを確認する
test("parser: parses nested elements", () => {
  const doc = ot.parse(ot.tokenize("<Parent><Child /></Parent>"))
  assert.equal(doc.children.length, 1)
  const parent = doc.children[0]
  assert.equal(parent.tagName, "Parent")
  assert.equal(parent.children.length, 1)
  assert.equal(parent.children[0].tagName, "Child")
  assert.equal(parent.children[0].selfClosing, true)
})

// タグ名・属性名・placeholder名でアンダースコア/ハイフンが使用できることを確認する
test("parser: accepts unified name spec for tag/attr/placeholder", () => {
  const doc = ot.parse(ot.tokenize("<A_b c_2-d=$my_value />"))
  assert.equal(doc.children[0].tagName, "A_b")
  const value = doc.children[0].attributes["c_2-d"]
  assert.deepStrictEqual(value, { type: "placeholder", name: "my_value" })
})

// デコレーションを複数解析できることを確認する
test("parser: parses decorations", () => {
  const doc = ot.parse(ot.tokenize("<Card .elevated .rounded_lg />"))
  const card = doc.children[0]
  assert.equal(card.decorations.length, 2)
  assert.equal(card.decorations[0].name, "elevated")
  assert.equal(card.decorations[1].name, "rounded_lg")
})

// 属性の後ろにデコレーションが続いても解析できることを確認する
test("parser: parses decoration after attribute", () => {
  const doc = ot.parse(ot.tokenize('<Badge label="new" .primary />'))
  const badge = doc.children[0]
  assert.equal(badge.attributes["label"], "new")
  assert.equal(badge.decorations.length, 1)
  assert.equal(badge.decorations[0].name, "primary")
})

// デコレーションと属性が交互に並んでも解析できることを確認する
test("parser: parses alternating decorations and attributes", () => {
  const doc = ot.parse(ot.tokenize("<Widget .d1 count=1 .d2 enabled=true />"))
  const widget = doc.children[0]
  assert.equal(widget.decorations.length, 2)
  assert.equal(widget.decorations[0].name, "d1")
  assert.equal(widget.decorations[1].name, "d2")
  assert.equal(widget.attributes["count"], 1)
  assert.equal(widget.attributes["enabled"], true)
})

// 文字列属性を解析できることを確認する
test("parser: parses string attribute", () => {
  const doc = ot.parse(ot.tokenize('<Identity name="Lumina" />'))
  assert.equal(doc.children[0].attributes["name"], "Lumina")
})

// 数値属性を解析できることを確認する
test("parser: parses numeric attribute", () => {
  const doc = ot.parse(ot.tokenize("<Identity level=42 />"))
  assert.equal(doc.children[0].attributes["level"], 42)
})

// 真偽値属性を解析できることを確認する
test("parser: parses boolean attribute", () => {
  const doc = ot.parse(ot.tokenize("<Payload success=true />"))
  assert.equal(doc.children[0].attributes["success"], true)
})

// null属性を解析できることを確認する
test("parser: parses null attribute", () => {
  const doc = ot.parse(ot.tokenize("<Skills passive=null />"))
  assert.equal(doc.children[0].attributes["passive"], null)
})

// オブジェクト属性を解析できることを確認する
test("parser: parses object attribute", () => {
  const doc = ot.parse(ot.tokenize('<Stats base={"hp": 1500, "mp": 800} />'))
  assert.deepStrictEqual(doc.children[0].attributes["base"], {
    hp: 1500,
    mp: 800,
  })
})

// 配列属性を解析できることを確認する
test("parser: parses array attribute", () => {
  const doc = ot.parse(ot.tokenize("<Stats modifiers=[1.2, 0.9, 1.05] />"))
  assert.deepStrictEqual(doc.children[0].attributes["modifiers"], [1.2, 0.9, 1.05])
})

// 複数のルート要素を解析できることを確認する
test("parser: parses multiple root elements", () => {
  const doc = ot.parse(ot.tokenize("<A /><B /><C />"))
  assert.equal(doc.children.length, 3)
  assert.equal(doc.children[0].tagName, "A")
  assert.equal(doc.children[1].tagName, "B")
  assert.equal(doc.children[2].tagName, "C")
})

// READMEのCharacter完全例を解析できることを確認する
test("parser: parses complete README Character example", () => {
  const input = `
    <Character .hero .rare_ssr>
      <Identity name="Lumina" level=42 />
      <Stats
        base={"hp": 1500, "mp": 800}
        modifiers=[1.2, 0.9, 1.05]
      />
      <Inventory>
        <Weapon .enchanted id="w-99" durability=0.85 />
        <Skills
          active=[{"name": "Fireball", "damage": 250}, {"name": "Heal", "amount": 100}]
          passive=null
        />
      </Inventory>
    </Character>
  `
  const doc = ot.parse(ot.tokenize(input))
  assert.equal(doc.children.length, 1)

  const character = doc.children[0]
  assert.equal(character.tagName, "Character")
  assert.equal(character.decorations.length, 2)
  assert.equal(character.decorations[0].name, "hero")
  assert.equal(character.decorations[1].name, "rare_ssr")
  assert.equal(character.children.length, 3)

  const identity = character.children[0]
  assert.equal(identity.tagName, "Identity")
  assert.equal(identity.attributes["name"], "Lumina")
  assert.equal(identity.attributes["level"], 42)
  assert.equal(identity.selfClosing, true)

  const stats = character.children[1]
  assert.equal(stats.tagName, "Stats")
  assert.deepStrictEqual(stats.attributes["base"], { hp: 1500, mp: 800 })
  assert.deepStrictEqual(stats.attributes["modifiers"], [1.2, 0.9, 1.05])

  const inventory = character.children[2]
  assert.equal(inventory.tagName, "Inventory")
  assert.equal(inventory.children.length, 2)

  const weapon = inventory.children[0]
  assert.equal(weapon.tagName, "Weapon")
  assert.equal(weapon.decorations[0].name, "enchanted")
  assert.equal(weapon.attributes["id"], "w-99")
  assert.equal(weapon.attributes["durability"], 0.85)

  const skills = inventory.children[1]
  assert.equal(skills.tagName, "Skills")
  assert.deepStrictEqual(skills.attributes["active"], [
    { name: "Fireball", damage: 250 },
    { name: "Heal", amount: 100 },
  ])
  assert.equal(skills.attributes["passive"], null)
})

// 空入力から空のdocumentを返すことを確認する
test("parser: returns empty document for empty input", () => {
  const doc = ot.parse(ot.tokenize(""))
  assert.equal(doc.type, "document")
  assert.equal(doc.children.length, 0)
})

// タグ名・属性名・デコレーション名の許可文字を受理することを確認する
test("parser: accepts allowed identifier characters", () => {
  const doc = ot.parse(ot.tokenize('<A1-b .d_2-e k_3-f={"x":1} />'))
  assert.equal(doc.children.length, 1)
  const node = doc.children[0]
  assert.equal(node.tagName, "A1-b")
  assert.equal(node.decorations[0].name, "d_2-e")
  assert.deepStrictEqual(node.attributes["k_3-f"], { x: 1 })
})

// 指数表記の数値を解析できることを確認する
test("parser: parses scientific notation number", () => {
  const doc = ot.parse(ot.tokenize("<Metric value=1e3 />"))
  assert.equal(doc.children[0].attributes["value"], 1000)
})

// 空白が混在した複数ルート入力を解析できることを確認する
test("parser: parses multiple roots with mixed whitespace", () => {
  const input = `
    <A />
    <B>
      <C />
    </B>
    <D />
  `
  const doc = ot.parse(ot.tokenize(input))
  assert.equal(doc.children.length, 3)
  assert.equal(doc.children[1].tagName, "B")
  assert.equal(doc.children[1].children[0].tagName, "C")
})

// READMEのEvent例を複数ルートとして解析できることを確認する
test("parser: parses README Event example as multiple roots", () => {
  const input = `
    <Event .info timestamp=1710000000>
      <Payload type="login" success=true />
    </Event>

    <Event .warn .low_priority timestamp=1710000123>
      <Payload type="disk_usage" percent=85.5 />
    </Event>

    <Event .error .critical timestamp=1710000500>
      <Details code=500 message="Internal Server Error" trace_id="abc-123" />
      <Stacktrace frames=[{"fn": "main", "line": 42}, {"fn": "init", "line": 10}] />
    </Event>
  `

  const doc = ot.parse(ot.tokenize(input))
  assert.equal(doc.children.length, 3)
  assert.equal(doc.children[0].tagName, "Event")
  assert.equal(doc.children[1].decorations[1].name, "low_priority")
  assert.equal(doc.children[2].children[1].tagName, "Stacktrace")
})

// JSON属性の直後が/>でも構文解析できることを確認する
test("parser: parses json attribute immediately followed by slash-gt", () => {
  const doc = ot.parse(ot.tokenize('<A config={"k":1}/>'))
  assert.equal(doc.children.length, 1)
  assert.deepStrictEqual(doc.children[0].attributes["config"], { k: 1 })
})

// placeholder 属性を解析できることを確認する
test("parser: parses placeholder attribute", () => {
  const doc = ot.parse(ot.tokenize("<A attr=$myValue />"))
  assert.deepStrictEqual(doc.children[0].attributes["attr"], {
    type: "placeholder",
    name: "myValue",
  })
})

// placeholder 名にハイフンを含む場合も解析できることを確認する
test("parser: parses placeholder with hyphen in name", () => {
  const doc = ot.parse(ot.tokenize("<A x=$my-value-123 />"))
  assert.deepStrictEqual(doc.children[0].attributes["x"], {
    type: "placeholder",
    name: "my-value-123",
  })
})

// JSON 値と placeholder が混在する属性を解析できることを確認する
test("parser: parses mixed json and placeholder attributes", () => {
  const doc = ot.parse(ot.tokenize("<A .deco json={} ph=$abc />"))
  const node = doc.children[0]
  assert.deepStrictEqual(node.attributes["json"], {})
  assert.deepStrictEqual(node.attributes["ph"], { type: "placeholder", name: "abc" })
  assert.equal(node.decorations[0].name, "deco")
})

// --- グループ値 ---

// グループ値が GroupValue として AST に格納されることを確認する
test("parser: parses group value with placeholder and json", () => {
  const doc = ot.parse(ot.tokenize('<tag eq=($mode, "dark") />'))
  const node = doc.children[0]
  assert.deepStrictEqual(node.attributes["eq"], {
    type: "group",
    values: [{ type: "placeholder", name: "mode" }, "dark"],
  })
})

// 複数の JSON 値を持つグループ値を解析できることを確認する
test("parser: parses group value with multiple json values", () => {
  const doc = ot.parse(ot.tokenize('<tag items=(1, "hello", true) />'))
  const node = doc.children[0]
  assert.deepStrictEqual(node.attributes["items"], {
    type: "group",
    values: [1, "hello", true],
  })
})

// 空グループ値を解析できることを確認する
test("parser: parses empty group value", () => {
  const doc = ot.parse(ot.tokenize("<tag key=() />"))
  const node = doc.children[0]
  assert.deepStrictEqual(node.attributes["key"], {
    type: "group",
    values: [],
  })
})

// 単値属性とグループ値属性の共存を解析できることを確認する
test("parser: parses single value and group value attributes together", () => {
  const doc = ot.parse(ot.tokenize('<tag a="hello" b=($x, 42) c=true />'))
  const node = doc.children[0]
  assert.equal(node.attributes["a"], "hello")
  assert.deepStrictEqual(node.attributes["b"], {
    type: "group",
    values: [{ type: "placeholder", name: "x" }, 42],
  })
  assert.equal(node.attributes["c"], true)
})

// デコレーションとグループ値属性の共存を解析できることを確認する
test("parser: parses decoration and group value attributes together", () => {
  const doc = ot.parse(ot.tokenize('<tag .primary eq=($mode, "dark") />'))
  const node = doc.children[0]
  assert.equal(node.decorations.length, 1)
  assert.equal(node.decorations[0].name, "primary")
  assert.deepStrictEqual(node.attributes["eq"], {
    type: "group",
    values: [{ type: "placeholder", name: "mode" }, "dark"],
  })
})

// グループ値内の JSON オブジェクトを解析できることを確認する
test("parser: parses group value with json object", () => {
  const doc = ot.parse(ot.tokenize('<tag eq=({"a":1}, $ph) />'))
  const node = doc.children[0]
  assert.deepStrictEqual(node.attributes["eq"], {
    type: "group",
    values: [{ a: 1 }, { type: "placeholder", name: "ph" }],
  })
})

// --- カスタムデリミタ統合テスト ---

// パイプデリミタで自己閉じタグを解析できることを確認する
test("parser: pipe delimiter self-closing tag", () => {
  const otPipe = new onlytag({ tags: [{ opening: "|", closing: "|" }] })
  const doc = otPipe.parse(otPipe.tokenize("|Br /|"))
  assert.equal(doc.children.length, 1)
  assert.equal(doc.children[0].tagName, "Br")
  assert.equal(doc.children[0].selfClosing, true)
})

// パイプデリミタで開閉タグペアを解析できることを確認する
test("parser: pipe delimiter open-close pair", () => {
  const otPipe = new onlytag({ tags: [{ opening: "|", closing: "|" }] })
  const doc = otPipe.parse(otPipe.tokenize("|Div|| /Div|"))
  assert.equal(doc.children.length, 1)
  assert.equal(doc.children[0].tagName, "Div")
  assert.equal(doc.children[0].selfClosing, false)
})

// パイプデリミタでネストした要素を解析できることを確認する
test("parser: pipe delimiter nested elements", () => {
  const otPipe = new onlytag({ tags: [{ opening: "|", closing: "|" }] })
  const doc = otPipe.parse(otPipe.tokenize("|Parent||Child /|| /Parent|"))
  assert.equal(doc.children.length, 1)
  const parent = doc.children[0]
  assert.equal(parent.tagName, "Parent")
  assert.equal(parent.children.length, 1)
  assert.equal(parent.children[0].tagName, "Child")
  assert.equal(parent.children[0].selfClosing, true)
})

// カスタムデリミタで属性付き要素を解析できることを確認する
test("parser: custom delimiter with attributes", () => {
  const otPercent = new onlytag({ tags: [{ opening: "%", closing: "%" }] })
  const doc = otPercent.parse(otPercent.tokenize('%Identity name="Lumina" level=42 /%'))
  const node = doc.children[0]
  assert.equal(node.tagName, "Identity")
  assert.equal(node.attributes["name"], "Lumina")
  assert.equal(node.attributes["level"], 42)
})

// カスタムデリミタでデコレーション付き要素を解析できることを確認する
test("parser: custom delimiter with decorations", () => {
  const otCustom = new onlytag({ tags: [{ opening: "!", closing: "?" }] })
  const doc = otCustom.parse(otCustom.tokenize("!Card .elevated .rounded /?"))
  const card = doc.children[0]
  assert.equal(card.decorations.length, 2)
  assert.equal(card.decorations[0].name, "elevated")
  assert.equal(card.decorations[1].name, "rounded")
})

// カスタムデリミタで JSON オブジェクト属性を解析できることを確認する
test("parser: custom delimiter with json object attribute", () => {
  const otCustom = new onlytag({ tags: [{ opening: "#", closing: "#" }] })
  const doc = otCustom.parse(otCustom.tokenize('#Stats base={"hp": 1500} /#'))
  assert.deepStrictEqual(doc.children[0].attributes["base"], { hp: 1500 })
})

// カスタムデリミタで placeholder 属性を解析できることを確認する
test("parser: custom delimiter with placeholder attribute", () => {
  const otCustom = new onlytag({ tags: [{ opening: "|", closing: "|" }] })
  const doc = otCustom.parse(otCustom.tokenize("|A attr=$myValue /|"))
  assert.deepStrictEqual(doc.children[0].attributes["attr"], {
    type: "placeholder",
    name: "myValue",
  })
})

// 複数デリミタペアで異なるデリミタの要素をネストして解析できることを確認する
test("parser: multiple delimiter pairs nested parsing", () => {
  const otMulti = new onlytag({
    tags: [
      { opening: "<", closing: ">" },
      { opening: "!", closing: "?" },
    ],
  })
  const doc = otMulti.parse(otMulti.tokenize("<Parent>!Child /?</Parent>"))
  assert.equal(doc.children.length, 1)
  const parent = doc.children[0]
  assert.equal(parent.tagName, "Parent")
  assert.equal(parent.children.length, 1)
  assert.equal(parent.children[0].tagName, "Child")
})
