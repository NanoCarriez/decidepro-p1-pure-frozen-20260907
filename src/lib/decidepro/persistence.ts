import {
  ALT_META,
  emptyRatings,
  type Alternative,
  type AltId,
  type CriterionId,
} from "./model.ts";

export const STORAGE_KEY = "decidepro.evaluation.v1";

export type StoredEvaluation = {
  version: 1;
  alternatives: Alternative[];
};

function isBrowser(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined"
  );
}

export function hasMeaningfulEvaluation(alternatives: Alternative[]): boolean {
  for (const alt of alternatives) {
    const defaultName =
      ALT_META.find((m) => m.id === alt.id)?.defaultName ?? alt.id;
    if (alt.name.trim() !== defaultName) return true;
    for (const value of Object.values(alt.ratings)) {
      if (value !== null && value !== undefined) return true;
    }
  }
  return false;
}

function isAltId(value: unknown): value is AltId {
  return value === "a" || value === "b" || value === "c";
}

function normalizeRatings(raw: unknown): Alternative["ratings"] | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const ratings = emptyRatings();
  for (const key of Object.keys(ratings) as CriterionId[]) {
    const value = source[key];
    if (value === null || value === undefined) {
      ratings[key] = null;
      continue;
    }
    if (
      value === 1 ||
      value === 2 ||
      value === 3 ||
      value === 4 ||
      value === 5
    ) {
      ratings[key] = value;
      continue;
    }
    return null;
  }
  return ratings;
}

export function parseStoredEvaluation(raw: string): Alternative[] | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredEvaluation>;
    if (parsed.version !== 1 || !Array.isArray(parsed.alternatives)) return null;
    if (parsed.alternatives.length !== 3) return null;
    const byId = new Map<AltId, Alternative>();
    for (const item of parsed.alternatives) {
      if (!item || !isAltId(item.id) || typeof item.name !== "string") return null;
      const ratings = normalizeRatings(item.ratings);
      if (!ratings) return null;
      byId.set(item.id, { id: item.id, name: item.name, ratings });
    }
    if (!byId.has("a") || !byId.has("b") || !byId.has("c")) return null;
    return [byId.get("a")!, byId.get("b")!, byId.get("c")!];
  } catch {
    return null;
  }
}

export function loadEvaluation(): Alternative[] | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  return parseStoredEvaluation(raw);
}

export function saveEvaluation(alternatives: Alternative[]): void {
  if (!isBrowser()) return;
  if (!hasMeaningfulEvaluation(alternatives)) return;
  const payload: StoredEvaluation = { version: 1, alternatives };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearEvaluation(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function storageKeyPresent(): boolean {
  if (!isBrowser()) return false;
  return window.localStorage.getItem(STORAGE_KEY) !== null;
}
