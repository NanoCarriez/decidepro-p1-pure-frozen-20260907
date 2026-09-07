export const CRITERIA = [
  { id: "demanda", label: "Demanda", weight: 30 },
  { id: "margen", label: "Margen", weight: 20 },
  { id: "rapidez", label: "Rapidez para monetizar", weight: 20 },
  { id: "facilidad", label: "Facilidad de ejecución", weight: 15 },
  { id: "diferenciacion", label: "Diferenciación", weight: 15 },
] as const;

export type CriterionId = (typeof CRITERIA)[number]["id"];
export type Criterion = (typeof CRITERIA)[number];
export type AltId = "a" | "b" | "c";
export type Rating = 1 | 2 | 3 | 4 | 5;
export type RatingValue = Rating | null;

export const ALT_META: { id: AltId; defaultName: string }[] = [
  { id: "a", defaultName: "Idea A" },
  { id: "b", defaultName: "Idea B" },
  { id: "c", defaultName: "Idea C" },
];

export type Alternative = {
  id: AltId;
  name: string;
  ratings: Record<CriterionId, RatingValue>;
};

export type AppPhase =
  | "empty"
  | "scoring"
  | "validation_error"
  | "result"
  | "near_tie";

export function emptyRatings(): Record<CriterionId, RatingValue> {
  return {
    demanda: null,
    margen: null,
    rapidez: null,
    facilidad: null,
    diferenciacion: null,
  };
}

export function initialAlternatives(): Alternative[] {
  return ALT_META.map((m) => ({
    id: m.id,
    name: m.defaultName,
    ratings: emptyRatings(),
  }));
}

export function displayName(alt: Alternative): string {
  const trimmed = alt.name.trim();
  if (trimmed) return trimmed;
  return ALT_META.find((m) => m.id === alt.id)?.defaultName ?? alt.id;
}

export const NEAR_TIE_THRESHOLD = 3;
