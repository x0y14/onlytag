# onlytag

onlytag is a simple markup with three kinds of tags, JSON attributes, and decorations.

Unlike HTML, you cannot write raw text directly.

## Syntax

- Tags
  - Opening: `<tagname>`
  - Closing: `</tagname>`
  - Self-closing: `<tagname />`
- Attributes
  - Must be valid JSON: `data={ "key": "value" }` `url="https://..."` `level=1` `num=[1,2,3]` ...
- Decoration
  - Starts with a dot (e.g., `.deco` `.primary` `.title` `._hidden`)

---

- Allowed characters
  - Tag names, attribute names, and decoration names may contain only digits, letters (A–Z, a–z), `_`, and `-`.
- Whitespace
  - All whitespace is ignored.

## Examples

```txt
<AppLayout>
    <Header .fixed .glassmorphism>
        <NavigationMenu items=[{"label": "Home", "href": "/"}, {"label": "Docs", "href": "/docs"}] />
    </Header>
    <MainContent>
        <Card .elevated .rounded_lg>
            <Title .primary text="Welcome to onlytag" />
            <Button .large .success action={"type": "submit", "id": 101} />
        </Card>
    </MainContent>
</AppLayout>
```

```txt
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
```

```txt
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
```
