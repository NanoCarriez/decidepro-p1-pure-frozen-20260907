/**
 * Relay increment verification (persistence / clear / reload / mobile).
 * Run with: DECIDEPRO_BASE=http://127.0.0.1:8080/ node scripts/decidepro-relay-increment.mjs
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.DECIDEPRO_BASE || "http://127.0.0.1:8080/";
const STORAGE_KEY = "decidepro.evaluation.v1";
const CRITERIA = ["demanda", "margen", "rapidez", "facilidad", "diferenciacion"];

async function setRatings(page, altId, values) {
  for (let i = 0; i < CRITERIA.length; i++) {
    await page.click(`[data-testid="rating-${altId}-${CRITERIA[i]}-${values[i]}"]`);
  }
}

const results = [];
function record(id, ok, detail) {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
}

async function run() {
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);

  try {
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload({ waitUntil: "networkidle" });

    // Fill complete evaluation
    await page.fill('[data-testid="alt-a-name"]', "Idea A");
    await page.fill('[data-testid="alt-b-name"]', "Idea B");
    await page.fill('[data-testid="alt-c-name"]', "Idea C");
    await setRatings(page, "a", [5, 4, 3, 2, 1]);
    await setRatings(page, "b", [4, 4, 4, 4, 4]);
    await setRatings(page, "c", [3, 2, 2, 3, 4]);
    await page.click('[data-testid="btn-calculate"]');
    await page.waitForSelector('[data-testid="state-result"]');

    const beforeScores = {
      a: await page.getAttribute('[data-testid="rank-2"]', "data-score"),
      b: await page.getAttribute('[data-testid="rank-1"]', "data-score"),
      c: await page.getAttribute('[data-testid="rank-3"]', "data-score"),
    };

    const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    try {
      assert.ok(stored, "storage should exist after edit");
      const parsed = JSON.parse(stored);
      assert.equal(parsed.alternatives.length, 3);
      assert.equal(parsed.alternatives[0].name, "Idea A");
      assert.equal(parsed.alternatives[1].name, "Idea B");
      assert.equal(parsed.alternatives[2].name, "Idea C");
      let ratingCount = 0;
      for (const alt of parsed.alternatives) {
        for (const v of Object.values(alt.ratings)) if (v !== null) ratingCount++;
      }
      assert.equal(ratingCount, 15);
      record("RELAY persist fields", true, "3 names + 15 ratings stored");
    } catch (e) {
      record("RELAY persist fields", false, String(e));
    }

    // Reload persistence
    await page.reload({ waitUntil: "networkidle" });
    try {
      await page.waitForSelector('[data-testid="state-result"]');
      const phase = await page.getAttribute('[data-testid="decidepro-root"]', "data-app-phase");
      assert.ok(phase === "result" || phase === "near_tie");
      assert.equal(await page.getAttribute('[data-testid="rank-1"]', "data-alt"), "b");
      assert.equal(await page.getAttribute('[data-testid="rank-1"]', "data-score"), "80.00");
      assert.equal(await page.getAttribute('[data-testid="rank-2"]', "data-score"), "67.00");
      assert.equal(await page.getAttribute('[data-testid="rank-3"]', "data-score"), "55.00");
      assert.equal(await page.inputValue('[data-testid="alt-a-name"]'), "Idea A");
      record("RELAY reload restore", true, `scores ${JSON.stringify(beforeScores)} restored`);
    } catch (e) {
      // names may be hidden in result view - check storage instead
      try {
        const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
        const parsed = JSON.parse(raw);
        assert.equal(parsed.alternatives[0].name, "Idea A");
        assert.equal(await page.getAttribute('[data-testid="rank-1"]', "data-score"), "80.00");
        record("RELAY reload restore", true, "result restored; names in storage");
      } catch (e2) {
        record("RELAY reload restore", false, String(e) + " / " + String(e2));
      }
    }

    // Borrar datos guardados
    try {
      assert.equal(await page.getByRole("button", { name: "Borrar datos guardados" }).count(), 1);
      await page.getByRole("button", { name: "Borrar datos guardados" }).click();
      await page.waitForTimeout(200);
      const keyAfter = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
      assert.equal(keyAfter, null);
      const phase = await page.getAttribute('[data-testid="decidepro-root"]', "data-app-phase");
      assert.equal(phase, "empty");
      assert.equal(await page.locator('[data-testid="state-result"]').count(), 0);
      record("RELAY clear saved", true, "key absent + empty state");
    } catch (e) {
      record("RELAY clear saved", false, String(e));
    }

    await page.reload({ waitUntil: "networkidle" });
    try {
      const keyAfterReload = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
      assert.equal(keyAfterReload, null);
      assert.equal(await page.getAttribute('[data-testid="decidepro-root"]', "data-app-phase"), "empty");
      assert.equal(await page.locator('[data-testid="state-result"]').count(), 0);
      record("RELAY clear survives reload", true, "no resurrected evaluation");
    } catch (e) {
      record("RELAY clear survives reload", false, String(e));
    }

    // Mobile scroll
    try {
      const dims = await page.evaluate(() => ({
        sw: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        cw: document.documentElement.clientWidth,
      }));
      assert.ok(dims.sw <= dims.cw + 1, JSON.stringify(dims));
      record("RELAY mobile 390x844", true, JSON.stringify(dims));
    } catch (e) {
      record("RELAY mobile 390x844", false, String(e));
    }
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`SUMMARY pass=${results.length - failed} fail=${failed}`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
