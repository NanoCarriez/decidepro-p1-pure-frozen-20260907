import {
  CRITERIA,
  NEAR_TIE_THRESHOLD,
  displayName,
  type Alternative,
  type Criterion,
  type Rating,
  type RatingValue,
} from "./model.ts";

export function isValidRating(value: unknown): value is Rating {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatScore(n: number): string {
  return round2(n).toFixed(2);
}

export function weightedScore(
  ratings: Record<string, RatingValue>,
): number | null {
  let sum = 0;
  for (const criterion of CRITERIA) {
    const rating = ratings[criterion.id];
    if (!isValidRating(rating)) return null;
    sum += (rating / 5) * criterion.weight;
  }
  return round2(sum);
}

export type RankedRow = {
  id: Alternative["id"];
  name: string;
  score: number;
  rank: 1 | 2 | 3;
  ratings: Alternative["ratings"];
};

export type WinnerExplanation = {
  name: string;
  score: number;
  rank: 1;
  strongest: [Criterion, Criterion];
  weakest: Criterion;
  gap: number;
  nearTie: boolean;
  recommendation: string;
};

export type DecisionOk = {
  ok: true;
  ranked: RankedRow[];
  nearTie: boolean;
  gap: number;
  winner: RankedRow;
  second: RankedRow;
  explanation: WinnerExplanation;
};

export type DecisionErr = {
  ok: false;
  reason: "incomplete" | "invalid";
};

export type Decision = DecisionOk | DecisionErr;

function classifyMissing(
  ratings: Record<string, RatingValue>,
): "incomplete" | "invalid" | null {
  for (const criterion of CRITERIA) {
    const rating = ratings[criterion.id];
    if (rating === null || rating === undefined) return "incomplete";
    if (!isValidRating(rating)) return "invalid";
  }
  return null;
}

export function strongestAndWeakest(ratings: Record<string, RatingValue>): {
  strongest: [Criterion, Criterion];
  weakest: Criterion;
} {
  const rows = CRITERIA.map((criterion) => {
    const rating = ratings[criterion.id];
    const safe = isValidRating(rating) ? rating : 0;
    return {
      criterion,
      rating: safe,
      contribution: (safe / 5) * criterion.weight,
    };
  });

  const byStrong = [...rows].sort(
    (a, b) =>
      b.rating - a.rating ||
      b.criterion.weight - a.criterion.weight ||
      a.criterion.id.localeCompare(b.criterion.id),
  );
  const byWeak = [...rows].sort(
    (a, b) =>
      a.rating - b.rating ||
      b.criterion.weight - a.criterion.weight ||
      a.criterion.id.localeCompare(b.criterion.id),
  );

  return {
    strongest: [byStrong[0].criterion, byStrong[1].criterion],
    weakest: byWeak[0].criterion,
  };
}

function recommendationFor(
  winnerName: string,
  winnerScore: number,
  secondName: string,
  gap: number,
  strongest: [Criterion, Criterion],
  weakest: Criterion,
  nearTie: boolean,
): string {
  const score = formatScore(winnerScore);
  const gapTxt = formatScore(gap);
  if (nearTie) {
    return `${winnerName} lidera con ${score}, apenas ${gapTxt} puntos sobre ${secondName}. La decisión está cerrada: no comprometas recursos todavía. Revisa primero los criterios de mayor peso — Demanda (30%), Margen (20%) y Rapidez para monetizar (20%) — antes de actuar. ${winnerName} destaca hoy en ${strongest[0].label} y ${strongest[1].label}; su punto más débil es ${weakest.label}.`;
  }
  return `Prioriza ${winnerName} (${score}). Supera a ${secondName} por ${gapTxt} puntos: brecha suficiente para concentrar foco y capital ahora. Su ventaja está en ${strongest[0].label} y ${strongest[1].label}. El criterio más débil es ${weakest.label}: corrígelo en la ejecución, no lo uses para invertir el ranking.`;
}

export function computeDecision(alternatives: Alternative[]): Decision {
  let reason: "incomplete" | "invalid" | null = null;
  for (const alt of alternatives) {
    const classified = classifyMissing(alt.ratings);
    if (classified) {
      reason = classified === "invalid" ? "invalid" : reason ?? "incomplete";
    }
  }
  if (reason) return { ok: false, reason };

  const scored = alternatives.map((alt) => {
    const score = weightedScore(alt.ratings);
    if (score === null) {
      return null;
    }
    return {
      id: alt.id,
      name: displayName(alt),
      score,
      ratings: alt.ratings,
    };
  });

  if (scored.some((row) => row === null)) {
    return { ok: false, reason: "invalid" };
  }

  const sorted = [...(scored as NonNullable<(typeof scored)[number]>[])].sort(
    (a, b) => b.score - a.score || a.id.localeCompare(b.id),
  );

  const ranked: RankedRow[] = sorted.map((row, index) => ({
    ...row,
    rank: (index + 1) as 1 | 2 | 3,
  }));

  const winner = ranked[0];
  const second = ranked[1];
  const gap = round2(winner.score - second.score);
  const nearTie = gap < NEAR_TIE_THRESHOLD;
  const { strongest, weakest } = strongestAndWeakest(winner.ratings);

  return {
    ok: true,
    ranked,
    nearTie,
    gap,
    winner,
    second,
    explanation: {
      name: winner.name,
      score: winner.score,
      rank: 1,
      strongest,
      weakest,
      gap,
      nearTie,
      recommendation: recommendationFor(
        winner.name,
        winner.score,
        second.name,
        gap,
        strongest,
        weakest,
        nearTie,
      ),
    },
  };
}
