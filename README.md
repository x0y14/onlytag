# onlytag

A tag-only markup language parser for TypeScript. No raw text, no rendering — just structured parsing into a typed AST.

## Install

```sh
npm install onlytag
```

The package is distributed as an ES module.

## Quick Start

```ts
import { onlytag } from "onlytag"

const ot = new onlytag()

const tokens = ot.tokenize(`<Button .primary text="Click me" />`)
const doc = ot.parse(tokens)
```

`doc` is a `DocumentNode`:

```json
{
  "type": "document",
  "children": [
    {
      "type": "element",
      "name": "Button",
      "decorations": [{ "name": "primary" }],
      "attributes": { "text": "Click me" },
      "children": [],
      "selfClosing": true
    }
  ]
}
```

## How It Differs from HTML and XML

| Aspect | HTML | XML | onlytag |
|---|---|---|---|
| Raw text between tags | Allowed | Allowed | Not allowed |
| Attribute values | Strings | Strings | JSON, placeholder (`$name`), or group (`(...)`) |
| Decorations (`.name`) | No equivalent | No equivalent | Built-in |
| Custom delimiters | Fixed (`<`, `>`) | Fixed (`<`, `>`) | Configurable (e.g., `\|...\|`, `!...?`) |
| Placeholders (`$name`) | No equivalent | No equivalent | Built-in (parse only, no substitution) |
| Group values (`(v1, v2)`) | No equivalent | No equivalent | Built-in |
| Output | DOM tree | DOM tree | Typed AST (`DocumentNode`) |
| Rendering | Yes | Depends on processor | No — parse only |

onlytag is not a replacement for HTML or XML. It is a structured markup language designed for machine-readable, tag-only documents where every piece of data is expressed as a tag, an attribute value, or a decoration.

## Concepts

### Tag

A tag is the fundamental unit of structure. There are three forms:

| Form | Syntax | Description |
|---|---|---|
| Opening | `<TagName>` | Begins an element that contains children |
| Closing | `</TagName>` | Ends the matching opening tag |
| Self-closing | `<TagName />` | A complete element with no children |

All identifiers (tag names, attribute keys, decoration names, placeholder names) follow the same naming rule: they must start with a letter and may contain letters, digits, underscores, and hyphens (`[a-zA-Z][a-zA-Z0-9_-]*`). Tag names are case-sensitive.

A document can have multiple top-level tags:

```
<A />
<B />
<C />
```

This produces a `DocumentNode` with three children.

### Attribute

Attributes attach data to a tag using `key=value` syntax. The key follows the same naming rule as tag names (`[a-zA-Z][a-zA-Z0-9_-]*`). The value must be one of the following:

**JSON values** — any valid JSON literal:

| Type | Example |
|---|---|
| String | `name="Lumina"` |
| Number | `level=42` |
| Boolean | `active=true` |
| Null | `slot=null` |
| Object | `config={"key": "value"}` |
| Array | `items=[1, 2, 3]` |

**Placeholder** — a symbolic reference written as `$name`:

```
<Button action=$submitHandler />
```

In the AST, this becomes `{ type: "placeholder", name: "submitHandler" }`. The library parses placeholders but does not perform any substitution or replacement. Consumers are responsible for resolving placeholders in application code.

**Group value** — a parenthesized, comma-separated list of JSON values and/or placeholders:

```
<Filter eq=($mode, "dark", 1) />
```

In the AST, this becomes `{ type: "group", values: [{ type: "placeholder", name: "mode" }, "dark", 1] }`.

An empty group is also valid:

```
<Tag key=() />
```

### Decoration

Decorations are flag-like annotations written as `.name` inside a tag. They carry no value — their presence is the signal.

```
<Card .elevated .rounded_lg />
```

Decoration names follow the same naming rule as tag names (`[a-zA-Z][a-zA-Z0-9_-]*`). Decorations and attributes can be freely interleaved:

```
<Widget .d1 count=1 .d2 enabled=true />
```

### Custom Delimiters

By default, tags use `<` and `>` as delimiters. You can configure alternative delimiter pairs through the `tags` option:

```ts
const ot = new onlytag({ tags: [{ opening: "|", closing: "|" }] })
const doc = ot.parse(ot.tokenize(`|Button .primary text="Click me" /|`))
```

Symmetric pairs (same character for opening and closing) are supported. You can also define multiple delimiter pairs simultaneously:

```ts
const ot = new onlytag({
  tags: [
    { opening: "<", closing: ">" },
    { opening: "|", closing: "|" },
  ],
})
const doc = ot.parse(ot.tokenize(`<Parent>|Child /|</Parent>`))
```

Allowed delimiter characters: `!`, `#`, `%`, `&`, `*`, `+`, `;`, `<`, `>`, `?`, `@`, `^`, `|`, `~`

Each character can only appear in one pair. Within a single pair, the opening and closing characters may be the same.

## Whitespace

All whitespace (spaces, tabs, newlines) is ignored outside of JSON string literals. These two are equivalent:

```
<A level=1 />
```

```
<A
  level=1
/>
```

Whitespace inside JSON string attribute values (e.g., `name="hello world"`) is preserved as part of the JSON literal.

## Options

The `onlytag` constructor accepts an optional `Options` object to control which features are allowed:

| Option | Type | Default | Description |
|---|---|---|---|
| `allowDecorations` | `boolean` | `true` | Allow `.name` decoration syntax |
| `allowAttributes` | `boolean` | `true` | Allow `key=value` attribute syntax |
| `allowPlaceholders` | `boolean` | `true` | Allow `$name` placeholder values |
| `allowGroup` | `boolean` | `true` | Allow `(v1, v2, ...)` group values |
| `allowMixedDelimiters` | `boolean` | `true` | Allow the same tag name to use different delimiter pairs |
| `allowInconsistentClosures` | `boolean` | `true` | Allow a tag name to be used as both self-closing and open/close |
| `tags` | `TagDelimiterPair[]` | `[{ opening: "<", closing: ">" }]` | Active delimiter pairs |
| `maxNestingDepth` | `number` | `1024` | Maximum nesting depth for elements |

When an option is set to `false`, using the corresponding feature throws an error.

```ts
// Tags only — no decorations, no attributes, no placeholders
const strict = new onlytag({
  allowDecorations: false,
  allowAttributes: false,
  allowPlaceholders: false,
})
```

## Usage Examples

### Nested Elements with Decorations and Attributes

```
<Character .hero .rare>
  <Identity name="Lumina" level=42 />
  <Stats base={"hp": 1500, "mp": 800} modifiers=[1.2, 0.9] />
  <Inventory>
    <Weapon .enchanted id="w-99" durability=0.85 />
  </Inventory>
</Character>
```

### Custom Delimiters with Group Values for Conditional-Like Patterns

By combining custom delimiters, attributes, and group values, you can express conditional-like structures. Note that onlytag only parses — interpretation is up to the consumer.

```ts
const ot = new onlytag({
  tags: [
    { opening: "<", closing: ">" },
    { opening: "|", closing: "|" },
  ],
})

const input = `
<Layout>
  <Header title="My App" />
  | if equal=($theme, "dark") /|
  <Body>
    <Content text="Hello" />
  </Body>
</Layout>
`

const doc = ot.parse(ot.tokenize(input))
```

The `| if equal=($theme, "dark") /|` tag uses pipe delimiters with a group value containing a placeholder and a string. The library parses it into an AST node — it does not evaluate the condition.

### Strict Options for Structured Logging

With restrictive options, onlytag can be used to define structured log entries. Multiple top-level tags are supported:

```ts
const ot = new onlytag({
  allowDecorations: true,
  allowAttributes: true,
  allowPlaceholders: false,
  allowInconsistentClosures: false,
})

const input = `
<Event .info timestamp=1710000000>
  <Payload type="login" success=true />
</Event>

<Event .warn timestamp=1710000123>
  <Payload type="disk_usage" percent=85.5 />
</Event>

<Event .error .critical timestamp=1710000500>
  <Details code=500 message="Internal Server Error" />
</Event>
`

const doc = ot.parse(ot.tokenize(input))
// doc.children.length === 3
```

By disabling placeholders and inconsistent closures, you ensure a stricter, more predictable document format suitable for structured records.

## Serialization

The `onlytag` class provides `dump` for JSON serialization of the AST:

```ts
const ot = new onlytag()

// Parse
const doc = ot.parse(ot.tokenize(`<Button .primary text="Click me" />`))

// Serialize to JSON string
const json = ot.dump(doc)
```

`dump` calls `JSON.stringify` on the `DocumentNode`.

## Limitations

- No raw text between tags — all content must be expressed as tags, attributes, or decorations
- No placeholder substitution — `$name` placeholders are parsed into the AST but not replaced or resolved
- No rendering or execution — onlytag is a parser only; interpretation of the AST is the consumer's responsibility
- No template engine features — no loops, conditionals, or includes

## License

MIT
