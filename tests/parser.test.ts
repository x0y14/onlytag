import { test, assert } from "vitest";
import { tokenize, parse } from "../src/index.js";

test("単一自己閉じタグ", () => {
  const doc = parse(tokenize("<Br />"));
  assert.equal(doc.type, "document");
  assert.equal(doc.children.length, 1);
  assert.equal(doc.children[0].tagName, "Br");
  assert.equal(doc.children[0].selfClosing, true);
  assert.equal(doc.children[0].children.length, 0);
});

test("空の開閉タグペア", () => {
  const doc = parse(tokenize("<Div></Div>"));
  assert.equal(doc.children.length, 1);
  assert.equal(doc.children[0].tagName, "Div");
  assert.equal(doc.children[0].selfClosing, false);
  assert.equal(doc.children[0].children.length, 0);
});

test("ネスト要素", () => {
  const doc = parse(tokenize("<Parent><Child /></Parent>"));
  assert.equal(doc.children.length, 1);
  const parent = doc.children[0];
  assert.equal(parent.tagName, "Parent");
  assert.equal(parent.children.length, 1);
  assert.equal(parent.children[0].tagName, "Child");
  assert.equal(parent.children[0].selfClosing, true);
});

test("decoration解析", () => {
  const doc = parse(tokenize("<Card .elevated .rounded_lg />"));
  const card = doc.children[0];
  assert.equal(card.decorations.length, 2);
  assert.equal(card.decorations[0].name, "elevated");
  assert.equal(card.decorations[1].name, "rounded_lg");
});

test("文字列属性", () => {
  const doc = parse(tokenize('<Identity name="Lumina" />'));
  assert.equal(doc.children[0].attributes["name"], "Lumina");
});

test("数値属性", () => {
  const doc = parse(tokenize("<Identity level=42 />"));
  assert.equal(doc.children[0].attributes["level"], 42);
});

test("boolean属性", () => {
  const doc = parse(tokenize("<Payload success=true />"));
  assert.equal(doc.children[0].attributes["success"], true);
});

test("null属性", () => {
  const doc = parse(tokenize("<Skills passive=null />"));
  assert.equal(doc.children[0].attributes["passive"], null);
});

test("オブジェクト属性", () => {
  const doc = parse(tokenize('<Stats base={"hp": 1500, "mp": 800} />'));
  assert.deepStrictEqual(doc.children[0].attributes["base"], {
    hp: 1500,
    mp: 800,
  });
});

test("配列属性", () => {
  const doc = parse(tokenize("<Stats modifiers=[1.2, 0.9, 1.05] />"));
  assert.deepStrictEqual(doc.children[0].attributes["modifiers"], [1.2, 0.9, 1.05]);
});

test("複数ルート要素", () => {
  const doc = parse(tokenize("<A /><B /><C />"));
  assert.equal(doc.children.length, 3);
  assert.equal(doc.children[0].tagName, "A");
  assert.equal(doc.children[1].tagName, "B");
  assert.equal(doc.children[2].tagName, "C");
});

test("READMEのCharacter完全例", () => {
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
  `;
  const doc = parse(tokenize(input));
  assert.equal(doc.children.length, 1);

  const character = doc.children[0];
  assert.equal(character.tagName, "Character");
  assert.equal(character.decorations.length, 2);
  assert.equal(character.decorations[0].name, "hero");
  assert.equal(character.decorations[1].name, "rare_ssr");
  assert.equal(character.children.length, 3);

  const identity = character.children[0];
  assert.equal(identity.tagName, "Identity");
  assert.equal(identity.attributes["name"], "Lumina");
  assert.equal(identity.attributes["level"], 42);
  assert.equal(identity.selfClosing, true);

  const stats = character.children[1];
  assert.equal(stats.tagName, "Stats");
  assert.deepStrictEqual(stats.attributes["base"], { hp: 1500, mp: 800 });
  assert.deepStrictEqual(stats.attributes["modifiers"], [1.2, 0.9, 1.05]);

  const inventory = character.children[2];
  assert.equal(inventory.tagName, "Inventory");
  assert.equal(inventory.children.length, 2);

  const weapon = inventory.children[0];
  assert.equal(weapon.tagName, "Weapon");
  assert.equal(weapon.decorations[0].name, "enchanted");
  assert.equal(weapon.attributes["id"], "w-99");
  assert.equal(weapon.attributes["durability"], 0.85);

  const skills = inventory.children[1];
  assert.equal(skills.tagName, "Skills");
  assert.deepStrictEqual(skills.attributes["active"], [
    { name: "Fireball", damage: 250 },
    { name: "Heal", amount: 100 },
  ]);
  assert.equal(skills.attributes["passive"], null);
});

test("空入力 → 空document", () => {
  const doc = parse(tokenize(""));
  assert.equal(doc.type, "document");
  assert.equal(doc.children.length, 0);
});

test("識別子の許可文字（タグ・属性・decoration）", () => {
  const doc = parse(tokenize('<A_1-b .d_2-e k_3-f={"x":1} />'));
  assert.equal(doc.children.length, 1);
  const node = doc.children[0];
  assert.equal(node.tagName, "A_1-b");
  assert.equal(node.decorations[0].name, "d_2-e");
  assert.deepStrictEqual(node.attributes["k_3-f"], { x: 1 });
});

test("数値表現（指数表記）", () => {
  const doc = parse(tokenize("<Metric value=1e3 />"));
  assert.equal(doc.children[0].attributes["value"], 1000);
});

test("複数ルート + 空白混在", () => {
  const input = `
    <A />
    <B>
      <C />
    </B>
    <D />
  `;
  const doc = parse(tokenize(input));
  assert.equal(doc.children.length, 3);
  assert.equal(doc.children[1].tagName, "B");
  assert.equal(doc.children[1].children[0].tagName, "C");
});

test("README Event例を複数ルートで解析", () => {
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
  `;

  const doc = parse(tokenize(input));
  assert.equal(doc.children.length, 3);
  assert.equal(doc.children[0].tagName, "Event");
  assert.equal(doc.children[1].decorations[1].name, "low_priority");
  assert.equal(doc.children[2].children[1].tagName, "Stacktrace");
});
