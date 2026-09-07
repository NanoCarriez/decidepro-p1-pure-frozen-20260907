/**
 * DecidePro — 10 mandatory product tests (P1).
 *
 * Reproducible path (dev server already on :8080):
 *   node scripts/decidepro-mandatory.mjs
 *
 * Optional:
 *   DECIDEPRO_BASE=http://127.0.0.1:8080/ node scripts/decidepro-mandatory.mjs
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.DECIDEPRO_BASE || "http://127.0.0.1:8080/";
const CRITERIA = [
  "demanda",
  "margen",
  "rapidez",
  "facilidad",
  "diferenciacion",
];

async function setRatings(page, altId, values) {
  for (let i = 0; i < CRITERIA.length; i++) {
    await page.click(
      `[data-testid="rating-${altId}-${CRITERIA[i]}-${values[i]}"]`,
    );
  }
}

async function phaseOf(page) {
  return page.getAttribute("[data-testid=decidepro-root]", "data-app-phase");
}

const results = [];

function record(id, ok, detail) {
  results.push({ id, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${id}  ${detail}`);
}

async function run() {
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
  });
  page.setDefaultTimeout(8000);

  try {
    await page.goto(BASE, { waitUntil: "networkidle" });

    // TEST 1 — EMPTY STATE
    try {
      const phase = await phaseOf(page);
      const rankingCount = await page.locator("[data-testid=state-result]").count();
      const winnerCount = await page.locator("[data-testid=winner-block]").count();
      assert.equal(phase, "empty");
      assert.equal(rankingCount, 0);
      assert.equal(winnerCount, 0);
      record("TEST 1 EMPTY STATE", true, "no ranking on open");
    } catch (err) {
      record("TEST 1 EMPTY STATE", false, String(err));
    }

    // TEST 7 / 8 — 0 and 6 cannot be entered
    try {
      assert.equal(
        await page.locator("[data-testid=rating-a-demanda-0]").count(),
        0,
      );
      assert.equal(
        await page.locator("[data-testid=rating-a-demanda-6]").count(),
        0,
      );
      record("TEST 7 INVALID LOW", true, "rating 0 has no control");
      record("TEST 8 INVALID HIGH", true, "rating 6 has no control");
    } catch (err) {
      record("TEST 7 INVALID LOW", false, String(err));
      record("TEST 8 INVALID HIGH", false, String(err));
    }

    // Incomplete → validation
    await page.click("[data-testid=btn-calculate]");
    await page.waitForSelector("[data-testid=state-validation-error]");

    // TEST 2 + 3 + 4
    await setRatings(page, "a", [5, 4, 3, 2, 1]);
    await setRatings(page, "b", [5, 4, 4, 4, 2]);
    await setRatings(page, "c", [3, 4, 3, 2, 1]);
    await page.click("[data-testid=btn-calculate]");
    await page.waitForSelector("[data-testid=state-result]");

    try {
      const phase = await phaseOf(page);
      assert.ok(phase === "result" || phase === "near_tie");
      record("TEST 2 COMPLETE VALID INPUT", true, `phase=${phase}`);
    } catch (err) {
      record("TEST 2 COMPLETE VALID INPUT", false, String(err));
    }

    try {
      const scoreA = await page.getAttribute("[data-testid=score-a]", "textContent")
        .catch(() => null);
      const textA = (await page.locator("[data-testid=score-a]").innerText()).trim();
      assert.equal(textA, "67.00");
      record("TEST 3 EXACT SCORE FIXTURE", true, "Idea A = 67.00");
    } catch (err) {
      record("TEST 3 EXACT SCORE FIXTURE", false, String(err));
    }

    try {
      const r1 = await page.getAttribute("[data-testid=rank-1]", "data-alt");
      const r2 = await page.getAttribute("[data-testid=rank-2]", "data-alt");
      const r3 = await page.getAttribute("[data-testid=rank-3]", "data-alt");
      const s1 = await page.getAttribute("[data-testid=rank-1]", "data-score");
      const s2 = await page.getAttribute("[data-testid=rank-2]", "data-score");
      const s3 = await page.getAttribute("[data-testid=rank-3]", "data-score");
      assert.deepEqual([r1, r2, r3], ["b", "a", "c"]);
      assert.deepEqual([s1, s2, s3], ["80.00", "67.00", "55.00"]);
      record("TEST 4 RANK ORDER", true, "B 80 > A 67 > C 55");
    } catch (err) {
      record("TEST 4 RANK ORDER", false, String(err));
    }

    // TEST 9 — RESET
    await page.click("[data-testid=btn-reset]");
    await page.waitForSelector("[data-testid=state-empty]");
    try {
      const phase = await phaseOf(page);
      const rankingCount = await page.locator("[data-testid=state-result]").count();
      const nameA = await page.inputValue("[data-testid=alt-a-name]");
      assert.equal(phase, "empty");
      assert.equal(rankingCount, 0);
      assert.equal(nameA, "Idea A");
      record("TEST 9 RESET", true, "cleared to empty start");
    } catch (err) {
      record("TEST 9 RESET", false, String(err));
    }

    // TEST 5 — NEAR TIE 80 vs 78
    await setRatings(page, "a", [5, 5, 4, 3, 1]); // 78
    await setRatings(page, "b", [5, 4, 4, 4, 2]); // 80
    await setRatings(page, "c", [3, 4, 3, 2, 1]); // 55
    await page.click("[data-testid=btn-calculate]");
    await page.waitForSelector("[data-testid=state-result]");
    try {
      const phase = await phaseOf(page);
      const near = await page.locator("[data-testid=state-near-tie]").count();
      const gap = (await page.locator("[data-testid=winner-gap]").innerText()).trim();
      assert.equal(phase, "near_tie");
      assert.equal(near, 1);
      assert.equal(gap, "2.00");
      record("TEST 5 NEAR TIE", true, "80 vs 78 → NEAR_TIE true");
    } catch (err) {
      record("TEST 5 NEAR TIE", false, String(err));
    }

    await page.click("[data-testid=btn-reset]");
    await page.waitForSelector("[data-testid=state-empty]");

    // TEST 6 — NON-NEAR TIE 80 vs 77
    await setRatings(page, "a", [5, 5, 3, 4, 1]); // 77
    await setRatings(page, "b", [5, 4, 4, 4, 2]); // 80
    await setRatings(page, "c", [3, 4, 3, 2, 1]); // 55
    await page.click("[data-testid=btn-calculate]");
    await page.waitForSelector("[data-testid=state-result]");
    try {
      const phase = await phaseOf(page);
      const near = await page.locator("[data-testid=state-near-tie]").count();
      const gap = (await page.locator("[data-testid=winner-gap]").innerText()).trim();
      assert.equal(phase, "result");
      assert.equal(near, 0);
      assert.equal(gap, "3.00");
      record("TEST 6 NON-NEAR TIE", true, "80 vs 77 → NEAR_TIE false");
    } catch (err) {
      record("TEST 6 NON-NEAR TIE", false, String(err));
    }

    // TEST 10 — MOBILE 390x844
    try {
      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          clientWidth: doc.clientWidth,
          scrollWidth: doc.scrollWidth,
          bodyScroll: document.body.scrollWidth,
        };
      });
      const overflow = Math.max(metrics.scrollWidth, metrics.bodyScroll) > metrics.clientWidth + 1;
      const calcVisible = await page.locator("[data-testid=state-result]").isVisible();
      const winnerVisible = await page.locator("[data-testid=winner-block]").isVisible();
      assert.equal(overflow, false);
      assert.equal(calcVisible, true);
      assert.equal(winnerVisible, true);
      assert.equal(metrics.clientWidth, 390);
      record(
        "TEST 10 MOBILE 390x844",
        true,
        `no h-scroll, result visible, vw=${metrics.clientWidth}`,
      );
    } catch (err) {
      record("TEST 10 MOBILE 390x844", false, String(err));
    }

    await page.screenshot({
      path: "/workspace/screenshots/decidepro-mandatory-mobile.png",
      fullPage: true,
    });
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log("");
  console.log(
    `SUMMARY  ${results.filter((r) => r.ok).length}/${results.length} passed`,
  );
  if (failed.length) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
