import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { initialAlternatives, type Alternative, type Rating } from "./model.ts";
import {
  STORAGE_KEY,
  clearEvaluation,
  hasMeaningfulEvaluation,
  loadEvaluation,
  parseStoredEvaluation,
  saveEvaluation,
  storageKeyPresent,
} from "./persistence.ts";
import { computeDecision } from "./score.ts";

function ratings(
  demanda: Rating,
  margen: Rating,
  rapidez: Rating,
  facilidad: Rating,
  diferenciacion: Rating,
): Alternative["ratings"] {
  return { demanda, margen, rapidez, facilidad, diferenciacion };
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

describe("DecidePro persistence", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = {
      localStorage: memoryStorage(),
    };
  });

  it("saves and loads names plus all 15 ratings", () => {
    const alts = initialAlternatives();
    alts[0].name = "Alpha";
    alts[1].name = "Beta";
    alts[2].name = "Gamma";
    alts[0].ratings = ratings(5, 4, 3, 2, 1);
    alts[1].ratings = ratings(4, 4, 4, 4, 4);
    alts[2].ratings = ratings(3, 2, 2, 3, 4);
    assert.equal(hasMeaningfulEvaluation(alts), true);
    saveEvaluation(alts);
    assert.equal(storageKeyPresent(), true);
    const loaded = loadEvaluation();
    assert.ok(loaded);
    assert.equal(loaded![0].name, "Alpha");
    assert.equal(loaded![1].name, "Beta");
    assert.equal(loaded![2].name, "Gamma");
    assert.deepEqual(loaded![0].ratings, ratings(5, 4, 3, 2, 1));
    assert.deepEqual(loaded![1].ratings, ratings(4, 4, 4, 4, 4));
    assert.deepEqual(loaded![2].ratings, ratings(3, 2, 2, 3, 4));
    const decision = computeDecision(loaded!);
    assert.equal(decision.ok, true);
    if (!decision.ok) return;
    assert.deepEqual(
      decision.ranked.map((r) => r.id),
      ["b", "a", "c"],
    );
  });

  it("clearEvaluation removes the storage key", () => {
    const alts = initialAlternatives();
    alts[0].ratings = ratings(5, 5, 5, 5, 5);
    saveEvaluation(alts);
    assert.equal(storageKeyPresent(), true);
    clearEvaluation();
    assert.equal(storageKeyPresent(), false);
    assert.equal(window.localStorage.getItem(STORAGE_KEY), null);
    assert.equal(loadEvaluation(), null);
  });

  it("does not save empty default evaluation", () => {
    const alts = initialAlternatives();
    assert.equal(hasMeaningfulEvaluation(alts), false);
    saveEvaluation(alts);
    assert.equal(storageKeyPresent(), false);
  });

  it("parseStoredEvaluation rejects malformed payloads", () => {
    assert.equal(parseStoredEvaluation("{"), null);
    assert.equal(parseStoredEvaluation(JSON.stringify({ version: 2, alternatives: [] })), null);
  });
});
