import { test, assert } from "vitest"
import { onlytag } from "../src/onlytag.js"

const ot = new onlytag()

function buildFlatDocument(size: number): string {
  return Array.from({ length: size }, (_, i) => `<Node${i} value=${i} />`).join("")
}

function measureMs(fn: () => void, repeat = 5): number {
  const samples: number[] = []
  for (let i = 0; i < repeat; i += 1) {
    const started = Date.now()
    fn()
    samples.push(Date.now() - started)
  }
  return samples.reduce((sum, value) => sum + value, 0) / samples.length
}

// tokenizeの処理時間が入力サイズに対して準線形で増えることを確認する
test("performance: tokenize scales near linearly with input size", () => {
  const smallInput = buildFlatDocument(200)
  const largeInput = buildFlatDocument(2_000)

  const smallMs = measureMs(() => {
    ot.tokenize(smallInput)
  })
  const largeMs = measureMs(() => {
    ot.tokenize(largeInput)
  })

  const inputRatio = largeInput.length / smallInput.length
  const timeRatio = largeMs / Math.max(smallMs, 0.01)
  assert.isBelow(timeRatio, inputRatio * 3.0)
})

// parseの処理時間が入力サイズに対して準線形で増えることを確認する
test("performance: parse scales near linearly with input size", () => {
  const smallInput = buildFlatDocument(100)
  const largeInput = buildFlatDocument(1_000)

  const smallMs = measureMs(() => {
    ot.parse(ot.tokenize(smallInput))
  })
  const largeMs = measureMs(() => {
    ot.parse(ot.tokenize(largeInput))
  })

  const inputRatio = largeInput.length / smallInput.length
  const timeRatio = largeMs / Math.max(smallMs, 0.01)
  assert.isBelow(timeRatio, inputRatio * 2.5)
})

// 空白を大量に含むJSON値のtokenizeが線形時間で処理されることを確認する
test("performance: tokenize with whitespace-heavy JSON scales linearly", () => {
  const buildWhitespaceJson = (spaces: number): string => {
    const padding = " ".repeat(spaces)
    return `<A value={"a"${padding}:${padding}1} />`
  }

  const smallInput = buildWhitespaceJson(5_000)
  const largeInput = buildWhitespaceJson(50_000)

  const smallMs = measureMs(() => {
    ot.tokenize(smallInput)
  }, 10)
  const largeMs = measureMs(() => {
    ot.tokenize(largeInput)
  }, 10)

  const inputRatio = largeInput.length / smallInput.length
  const timeRatio = largeMs / Math.max(smallMs, 0.1)
  assert.isBelow(timeRatio, inputRatio * 3.0)
})

// 10,000タグ規模でも上限時間内に処理できることを確認する
test("performance: parses 10k tags within time budget", () => {
  const hugeInput = buildFlatDocument(10_000)
  const elapsed = measureMs(() => {
    ot.parse(ot.tokenize(hugeInput))
  }, 1)
  assert.isBelow(elapsed, 3_000)
})
