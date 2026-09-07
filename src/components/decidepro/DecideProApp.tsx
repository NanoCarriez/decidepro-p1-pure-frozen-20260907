import { useMemo, useState } from "react";
import { Pencil, RotateCcw, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALT_META,
  CRITERIA,
  displayName,
  initialAlternatives,
  type Alternative,
  type AppPhase,
  type CriterionId,
  type Rating,
} from "@/lib/decidepro/model";
import {
  computeDecision,
  formatScore,
  type DecisionOk,
} from "@/lib/decidepro/score";

const RATINGS: Rating[] = [1, 2, 3, 4, 5];

function filledCount(alternatives: Alternative[]): number {
  let count = 0;
  for (const alt of alternatives) {
    for (const criterion of CRITERIA) {
      if (alt.ratings[criterion.id] !== null) count += 1;
    }
  }
  return count;
}

export function DecideProApp() {
  const [alternatives, setAlternatives] = useState<Alternative[]>(
    initialAlternatives,
  );
  const [phase, setPhase] = useState<AppPhase>("empty");
  const [decision, setDecision] = useState<DecisionOk | null>(null);

  const complete = filledCount(alternatives);
  const showForm = phase !== "result" && phase !== "near_tie";

  function updateName(id: Alternative["id"], name: string) {
    setAlternatives((prev) =>
      prev.map((alt) => (alt.id === id ? { ...alt, name } : alt)),
    );
    setPhase((p) => (p === "empty" ? "scoring" : p));
  }

  function updateRating(
    id: Alternative["id"],
    criterionId: CriterionId,
    rating: Rating,
  ) {
    setAlternatives((prev) =>
      prev.map((alt) =>
        alt.id === id
          ? { ...alt, ratings: { ...alt.ratings, [criterionId]: rating } }
          : alt,
      ),
    );
    setPhase((p) => (p === "empty" || p === "result" || p === "near_tie" ? "scoring" : p));
  }

  function handleCalculate() {
    const next = computeDecision(alternatives);
    if (!next.ok) {
      setDecision(null);
      setPhase("validation_error");
      requestAnimationFrame(() => {
        document.getElementById("validation-error")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
      return;
    }
    setDecision(next);
    setPhase(next.nearTie ? "near_tie" : "result");
    requestAnimationFrame(() => {
      document.getElementById("resultado")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function handleEdit() {
    setPhase("scoring");
    setDecision(null);
    requestAnimationFrame(() => {
      document.getElementById("evaluacion")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function handleReset() {
    setAlternatives(initialAlternatives());
    setDecision(null);
    setPhase("empty");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const stateLabel = useMemo(() => {
    switch (phase) {
      case "empty":
        return "inicio";
      case "scoring":
        return "evaluación";
      case "validation_error":
        return "error";
      case "result":
        return "ranking";
      case "near_tie":
        return "empate cercano";
    }
  }, [phase]);

  return (
    <div
      className="min-h-dvh bg-bg text-ink"
      data-testid="decidepro-root"
      data-app-phase={phase}
    >
      <header className="border-b border-border bg-bg/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-fg">
              <Scale className="size-4" strokeWidth={1.75} aria-hidden />
            </span>
            <div>
              <p className="font-display text-lg leading-tight tracking-tight">
                DecidePro
              </p>
              <p className="text-xs text-muted">{stateLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            data-testid="btn-reset"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted transition-colors duration-150 hover:bg-surface hover:text-ink"
          >
            <RotateCcw className="size-4" aria-hidden />
            Reiniciar
          </button>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto w-full max-w-lg px-4 pt-6",
          showForm ? "pb-28" : "pb-10",
        )}
      >
        {phase === "empty" && (
          <section
            data-testid="state-empty"
            className="mb-6 rounded-xl border border-border bg-surface px-5 py-6"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              Matriz ponderada
            </p>
            <h1 className="font-display mt-2 text-[1.85rem] leading-[1.15] tracking-tight">
              Tres ideas. Una prioridad.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Puntúa cada opción de 1 a 5. DecidePro calcula un ranking 0–100 y
              te dice dónde concentrar el esfuerzo — sin intuición genérica.
            </p>
          </section>
        )}

        {phase === "validation_error" && (
          <div
            id="validation-error"
            role="alert"
            data-testid="state-validation-error"
            className="mb-5 rounded-lg border border-danger/30 bg-danger-bg px-4 py-3.5"
          >
            <p className="text-sm font-medium text-danger">
              Faltan valoraciones
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink/80">
              Completa las 15 notas (1–5) de las tres ideas para calcular un
              ranking válido. {complete} de 15 listas.
            </p>
          </div>
        )}

        {showForm && (
          <section id="evaluacion" data-testid="state-scoring">
            <div className="mb-3 flex items-end justify-between">
              <h2 className="font-display text-xl tracking-tight">
                Evaluación
              </h2>
              <p className="text-xs tabular-nums text-muted">
                {complete}/15 notas
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {alternatives.map((alt, index) => (
                <article
                  key={alt.id}
                  className="rounded-xl border border-border bg-surface p-4"
                  data-testid={`alt-card-${alt.id}`}
                >
                  <label className="block">
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                      Idea {index + 1}
                    </span>
                    <input
                      type="text"
                      value={alt.name}
                      maxLength={48}
                      onChange={(event) =>
                        updateName(alt.id, event.target.value)
                      }
                      data-testid={`alt-${alt.id}-name`}
                      aria-label={`Nombre de la idea ${index + 1}`}
                      className="mt-1.5 min-h-11 w-full rounded-md border border-border bg-bg px-3 font-display text-lg tracking-tight text-ink outline-none transition-shadow duration-150 focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </label>

                  <ul className="mt-4 flex flex-col gap-3">
                    {CRITERIA.map((criterion) => {
                      const selected = alt.ratings[criterion.id];
                      return (
                        <li key={criterion.id}>
                          <div className="mb-1.5 flex items-baseline justify-between gap-3">
                            <span className="text-sm font-medium leading-snug">
                              {criterion.label}
                            </span>
                            <span className="shrink-0 text-[11px] tabular-nums text-muted">
                              {criterion.weight}%
                            </span>
                          </div>
                          <div
                            className="grid grid-cols-5 gap-1.5"
                            role="radiogroup"
                            aria-label={`${criterion.label} para ${displayName(alt)}`}
                          >
                            {RATINGS.map((n) => {
                              const isOn = selected === n;
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  role="radio"
                                  aria-checked={isOn}
                                  data-testid={`rating-${alt.id}-${criterion.id}-${n}`}
                                  onClick={() =>
                                    updateRating(alt.id, criterion.id, n)
                                  }
                                  className={cn(
                                    "min-h-11 rounded-sm text-sm font-medium tabular-nums transition-colors duration-150",
                                    isOn
                                      ? "bg-accent text-accent-fg"
                                      : "border border-border bg-bg text-ink hover:border-accent/40",
                                  )}
                                >
                                  {n}
                                </button>
                              );
                            })}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        )}

        {(phase === "result" || phase === "near_tie") && decision && (
          <ResultPanel
            decision={decision}
            phase={phase}
            onEdit={handleEdit}
            onReset={handleReset}
          />
        )}
      </main>

      {showForm && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 px-4 py-3 backdrop-blur-sm">
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              data-testid="btn-calculate"
              onClick={handleCalculate}
              className="flex min-h-12 w-full items-center justify-center rounded-lg bg-accent px-4 text-[15px] font-medium text-accent-fg transition-transform duration-150 active:scale-[0.98]"
            >
              Calcular / Comparar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultPanel({
  decision,
  phase,
  onEdit,
  onReset,
}: {
  decision: DecisionOk;
  phase: AppPhase;
  onEdit: () => void;
  onReset: () => void;
}) {
  const { ranked, explanation, nearTie, gap } = decision;
  const maxScore = Math.max(...ranked.map((row) => row.score), 1);

  return (
    <section id="resultado" data-testid="state-result" className="flex flex-col gap-4">
      {phase === "near_tie" && (
        <div
          role="status"
          data-testid="state-near-tie"
          className="rounded-lg border border-warn/25 bg-warn-bg px-4 py-3.5"
        >
          <p className="text-sm font-medium text-warn">Decisión cerrada</p>
          <p className="mt-1 text-sm leading-relaxed text-ink/85">
            La diferencia entre {ranked[0].name} y {ranked[1].name} es{" "}
            {formatScore(gap)} puntos — menos de 3.00. Revisa Demanda, Margen y
            Rapidez para monetizar (los criterios de mayor peso) antes de
            actuar.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Ranking
        </p>
        <h2 className="font-display mt-1 text-2xl tracking-tight">
          Prioridad calculada
        </h2>
        <ol className="mt-4 flex flex-col gap-3">
          {ranked.map((row) => (
            <li
              key={row.id}
              data-testid={`rank-${row.rank}`}
              data-alt={row.id}
              data-score={formatScore(row.score)}
              className="rounded-lg border border-border bg-bg px-3 py-3"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] tabular-nums text-muted">
                    #{row.rank}
                  </p>
                  <p className="truncate font-display text-lg leading-tight tracking-tight">
                    {row.name}
                  </p>
                </div>
                <p
                  data-testid={`score-${row.id}`}
                  className="font-mono text-xl tabular-nums tracking-tight"
                >
                  {formatScore(row.score)}
                </p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(row.score / maxScore) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      </div>

      <article
        data-testid="winner-block"
        className="rounded-xl border border-border bg-surface p-5"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Recomendación
        </p>
        <h3
          data-testid="winner-name"
          className="font-display mt-1 text-[1.65rem] leading-tight tracking-tight"
        >
          {explanation.name}
        </h3>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Puntaje</dt>
            <dd data-testid="winner-score" className="font-mono text-base tabular-nums">
              {formatScore(explanation.score)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Posición</dt>
            <dd data-testid="winner-rank">1 de 3</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Fortalezas</dt>
            <dd data-testid="winner-strongest">
              {explanation.strongest[0].label}, {explanation.strongest[1].label}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Más débil</dt>
            <dd data-testid="winner-weakest">{explanation.weakest.label}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-muted">Brecha vs. #2</dt>
            <dd data-testid="winner-gap" className="font-mono tabular-nums">
              {formatScore(explanation.gap)}
            </dd>
          </div>
        </dl>
        <p
          data-testid="winner-recommendation"
          className="mt-4 text-sm leading-relaxed text-ink/90"
        >
          {explanation.recommendation}
        </p>
      </article>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          data-testid="btn-edit"
          onClick={onEdit}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface text-sm font-medium transition-colors duration-150 hover:border-accent/40"
        >
          <Pencil className="size-4" aria-hidden />
          Editar evaluación
        </button>
        <button
          type="button"
          onClick={onReset}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted hover:text-ink"
        >
          <RotateCcw className="size-4" aria-hidden />
          Reiniciar
        </button>
      </div>
    </section>
  );
}
