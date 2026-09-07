import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CRITERIA, emptyRatings, type Alternative, type Rating } from "./model.ts";
import {
  computeDecision,
  formatScore,
  isValidRating,
  weightedScore,
} from "./score.ts";

function ratings(
  demanda: Rating,
  margen: Rating,
  rapidez: Rating,
  facilidad: Rating,
  diferenciacion: Rating,
): Alternative["ratings"] {
  return { demanda, margen, rapidez, facilidad, diferenciacion };
}

function alt(
  id: Alternative["id"],
  name: string,
  r: Alternative["ratings"],
): Alternative {
  return { id, name, ratings: r };
}

describe("DecidePro scoring", () => {
  it("TEST 3 — exact score fixture 67.00", () => {
    const score = weightedScore(ratings(5, 4, 3, 2, 1));
    assert.equal(score, 67);
    assert.equal(formatScore(score!), "67.00");
  });

  it("TEST 4 — rank order B > A > C", () => {
    const decision = computeDecision([
      alt("a", "Idea A", ratings(5, 4, 3, 2, 1)), // 67
      alt("b", "Idea B", ratings(5, 4, 4, 4, 2)), // 80
      alt("c", "Idea C", ratings(3, 4, 3, 2, 1)), // 55
    ]);
    assert.equal(decision.ok, true);
    if (!decision.ok) return;
    assert.deepEqual(
      decision.ranked.map((row) => row.id),
      ["b", "a", "c"],
    );
    assert.equal(decision.ranked[0].score, 80);
    assert.equal(decision.ranked[1].score, 67);
    assert.equal(decision.ranked[2].score, 55);
  });

  it("TEST 5 — near tie 80.00 vs 78.00", () => {
    const decision = computeDecision([
      alt("a", "Idea A", ratings(5, 5, 4, 3, 1)), // 78
      alt("b", "Idea B", ratings(5, 4, 4, 4, 2)), // 80
      alt("c", "Idea C", ratings(3, 4, 3, 2, 1)), // 55
    ]);
    assert.equal(decision.ok, true);
    if (!decision.ok) return;
    assert.equal(decision.winner.score, 80);
    assert.equal(decision.second.score, 78);
    assert.equal(decision.gap, 2);
    assert.equal(decision.nearTie, true);
  });

  it("TEST 6 — non-near tie 80.00 vs 77.00 (strictly < 3.00)", () => {
    const decision = computeDecision([
      alt("a", "Idea A", ratings(5, 5, 3, 4, 1)), // 77
      alt("b", "Idea B", ratings(5, 4, 4, 4, 2)), // 80
      alt("c", "Idea C", ratings(3, 4, 3, 2, 1)), // 55
    ]);
    assert.equal(decision.ok, true);
    if (!decision.ok) return;
    assert.equal(decision.winner.score, 80);
    assert.equal(decision.second.score, 77);
    assert.equal(decision.gap, 3);
    assert.equal(decision.nearTie, false);
  });

  it("gap of exactly 3.00 is not a near tie", () => {
    const decision = computeDecision([
      alt("a", "Idea A", ratings(5, 5, 3, 4, 1)),
      alt("b", "Idea B", ratings(5, 4, 4, 4, 2)),
      alt("c", "Idea C", ratings(1, 1, 1, 1, 1)),
    ]);
    assert.equal(decision.ok, true);
    if (!decision.ok) return;
    assert.equal(decision.gap, 3);
    assert.equal(decision.nearTie, false);
  });

  it("TEST 7 — rating 0 is rejected", () => {
    assert.equal(isValidRating(0), false);
    const score = weightedScore({ ...emptyRatings(), demanda: 0 as never });
    assert.equal(score, null);
    const decision = computeDecision([
      alt("a", "Idea A", { ...ratings(5, 4, 3, 2, 1), demanda: 0 as unknown as Rating }),
      alt("b", "Idea B", ratings(5, 4, 4, 4, 2)),
      alt("c", "Idea C", ratings(3, 4, 3, 2, 1)),
    ]);
    assert.equal(decision.ok, false);
  });

  it("TEST 8 — rating 6 is rejected", () => {
    assert.equal(isValidRating(6), false);
    const decision = computeDecision([
      alt("a", "Idea A", { ...ratings(5, 4, 3, 2, 1), margen: 6 as unknown as Rating }),
      alt("b", "Idea B", ratings(5, 4, 4, 4, 2)),
      alt("c", "Idea C", ratings(3, 4, 3, 2, 1)),
    ]);
    assert.equal(decision.ok, false);
  });

  it("incomplete ratings do not produce a ranking", () => {
    const decision = computeDecision([
      alt("a", "Idea A", ratings(5, 4, 3, 2, 1)),
      { id: "b", name: "Idea B", ratings: emptyRatings() },
      alt("c", "Idea C", ratings(3, 4, 3, 2, 1)),
    ]);
    assert.equal(decision.ok, false);
    if (decision.ok) return;
    assert.equal(decision.reason, "incomplete");
  });

  it("weights sum to 100 and a perfect 5 scores 100.00", () => {
    const weightSum = CRITERIA.reduce((sum, c) => sum + c.weight, 0);
    assert.equal(weightSum, 100);
    assert.equal(weightedScore(ratings(5, 5, 5, 5, 5)), 100);
    assert.equal(formatScore(100), "100.00");
  });

  it("winner explanation includes strongest, weakest, gap and rank", () => {
    const decision = computeDecision([
      alt("a", "Lanzar PWA", ratings(5, 4, 3, 2, 1)),
      alt("b", "Curso vivo", ratings(5, 4, 4, 4, 2)),
      alt("c", "Newsletter", ratings(3, 4, 3, 2, 1)),
    ]);
    assert.equal(decision.ok, true);
    if (!decision.ok) return;
    assert.equal(decision.explanation.rank, 1);
    assert.equal(decision.explanation.name, "Curso vivo");
    assert.equal(decision.explanation.strongest.length, 2);
    assert.ok(decision.explanation.weakest.label.length > 0);
    assert.ok(decision.explanation.recommendation.includes("Curso vivo"));
    assert.ok(decision.explanation.recommendation.includes("13.00"));
  });

  it("rating type guard only accepts 1–5 integers", () => {
    const allowed: Rating[] = [1, 2, 3, 4, 5];
    for (const n of allowed) assert.equal(isValidRating(n), true);
    for (const n of [0, 6, -1, 1.5, 3.1, "5", null, undefined]) {
      assert.equal(isValidRating(n), false);
    }
  });
});
