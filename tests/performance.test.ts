import { test, assert } from "vitest";
import { tokenize, parse } from "../src/index.js";

function buildFlatDocument(size: number): string {
  return Array.from({ length: size }, (_, i) => `<Node_${i} value=${i} />`).join("");
}

function measureMs(fn: () => void, repeat = 5): number {
  const samples: number[] = [];
  for (let i = 0; i < repeat; i += 1) {
    const started = Date.now();
    fn();
    samples.push(Date.now() - started);
  }
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

test("tokenize は入力サイズ増加に対して準線形である", () => {
  const smallInput = buildFlatDocument(200);
  const largeInput = buildFlatDocument(2_000);

  const smallMs = measureMs(() => {
    tokenize(smallInput);
  });
  const largeMs = measureMs(() => {
    tokenize(largeInput);
  });

  const inputRatio = largeInput.length / smallInput.length;
  const timeRatio = largeMs / Math.max(smallMs, 0.01);
  assert.isBelow(timeRatio, inputRatio * 2.2);
});

test("parse は入力サイズ増加に対して準線形である", () => {
  const smallInput = buildFlatDocument(100);
  const largeInput = buildFlatDocument(1_000);

  const smallMs = measureMs(() => {
    parse(tokenize(smallInput));
  });
  const largeMs = measureMs(() => {
    parse(tokenize(largeInput));
  });

  const inputRatio = largeInput.length / smallInput.length;
  const timeRatio = largeMs / Math.max(smallMs, 0.01);
  assert.isBelow(timeRatio, inputRatio * 2.5);
});

test("10,000タグ規模でも実行時間上限内で処理できる", () => {
  const hugeInput = buildFlatDocument(10_000);
  const elapsed = measureMs(() => {
    parse(tokenize(hugeInput));
  }, 1);
  assert.isBelow(elapsed, 3_000);
});
