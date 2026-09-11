import assert from "node:assert/strict";
import { test } from "node:test";
import {
  gpsQuality,
  magnitude,
  MotionWindow,
  parseVisits,
  Visit,
} from "../src/domain";

test("aceleração agregada usa os três eixos, em g", () => {
  assert.equal(magnitude({ x: 0, y: 0, z: 1 }), 1);
  assert.ok(magnitude({ x: 1.2, y: 1.2, z: 1.2 }) > 2);
});

for (const [accuracy, label] of [
  [0, "Alta precisão"],
  [9.99, "Alta precisão"],
  [10, "Média precisão"],
  [30, "Média precisão"],
  [30.01, "Baixa precisão"],
  [null, "Precisão desconhecida"],
  [-1, "Precisão desconhecida"],
  [NaN, "Precisão desconhecida"],
] as const) {
  test(`GPS: ${accuracy} m → ${label}`, () =>
    assert.equal(gpsQuality(accuracy).label, label));
}

function stableWindow(g = 1) {
  const window = new MotionWindow(0);
  for (let now = 50; now <= 3000; now += 50)
    window.add({ x: 0, y: 0, z: g }, now);
  return window;
}
test("três segundos de amostras contínuas autorizam a conclusão", () =>
  assert.equal(stableWindow().result(3000), "stable"));
test("exatamente 2,0g é permitido: o limite é estritamente maior", () =>
  assert.equal(stableWindow(2).result(3000), "stable"));
test("um único pico bloqueia mesmo após o aparelho estabilizar", () => {
  const window = new MotionWindow(0);
  for (let now = 50; now <= 3000; now += 50)
    window.add({ x: 0, y: 0, z: now === 500 ? 2.01 : 1 }, now);
  assert.equal(window.result(3000), "unstable");
  assert.equal(window.peakG, 2.01);
});
test("não libera sem dados, com poucas amostras ou antes da janela", () => {
  assert.equal(new MotionWindow(0).result(3000), "missing");
  const short = new MotionWindow(0);
  short.add({ x: 0, y: 0, z: 1 }, 50);
  assert.equal(short.result(100), "missing");
});
test("amostras antigas ou com lacunas não autorizam", () => {
  assert.equal(stableWindow().result(4000), "missing");
  const gap = new MotionWindow(0);
  for (let now = 1000; now <= 3000; now += 50)
    gap.add({ x: 0, y: 0, z: 1 }, now);
  assert.equal(gap.result(3000), "missing");
});
test("dados inválidos do sensor não autorizam", () => {
  const window = stableWindow();
  window.add({ x: NaN, y: 0, z: 1 }, 3050);
  assert.equal(window.result(3050), "missing");
});
const visit: Visit = {
  id: "test",
  farm: "Boa Vista",
  technician: "Ana",
  crop: "Café",
  notes: "",
  condition: "Regular",
  location: { latitude: -23, longitude: -46, accuracy: 8, capturedAt: 1000 },
  photoUri: "file:///documents/photo.jpg",
  peakG: 1.1,
  createdAt: "2026-09-11T12:00:00.000Z",
};
test("histórico preserva os campos ao serializar e reabrir", () =>
  assert.deepEqual(parseVisits(JSON.stringify([visit])), [visit]));
test("primeira execução tem histórico vazio", () =>
  assert.deepEqual(parseVisits(null), []));
test("recusa histórico danificado em vez de tratá-lo como vazio", () => {
  for (const raw of [
    "invalid",
    "{}",
    "[null]",
    JSON.stringify([{ ...visit, farm: 1 }]),
    JSON.stringify([{ ...visit, location: { latitude: 120 } }]),
  ])
    assert.throws(() => parseVisits(raw));
});
test("aceita visita sem foto ou GPS", () => {
  const partial = { ...visit, photoUri: null, location: null };
  assert.deepEqual(parseVisits(JSON.stringify([partial])), [partial]);
});
