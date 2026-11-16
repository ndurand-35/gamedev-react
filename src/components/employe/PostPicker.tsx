import { FC, ReactElement } from "react";

import {
  COMPONENT_KINDS,
  ComponentKindId,
  ProductionPerson,
  STAT_SCALE,
  TIER_GATE,
} from "@/data/interface";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { setPost } from "@/data/redux/employeSlice";
import {
  craftBlocker,
  missingTechnology,
  recipeToRequirements,
  kindLabel,
} from "@/data/utils/recipes";
import { requirementsLabel } from "@/data/utils/component";
import { gateShift } from "@/data/utils/traits";
import { KindPill } from "@/components/component";

/** Travail propre d'une pièce, en jours de jeu pour cet employé (indicatif). */
const LABOR_DAYS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8 };

/**
 * Poste d'un employé de production : Auto, ou une pièce précise de sa
 * famille. Les pièces inaccessibles disent pourquoi (seuil, technologie). En
 * tête, ce qu'il fabrique ou ce qui lui manque.
 */
export const PostPicker: FC<{ employe: ProductionPerson }> = ({
  employe,
}): ReactElement | null => {
  const dispatch = useAppDispatch();
  const time = useAppSelector((s) => s.engine.time);
  const job = useAppSelector((s) => s.component.productionJobs?.[employe.id]);
  const waiting = useAppSelector(
    (s) => s.component.productionWaiting?.[employe.id],
  );
  const family = employe.assignedComponentType;
  if (!family) return null;

  const shift = gateShift(employe);
  const kinds = COMPONENT_KINDS.filter((k) => k.family === family);
  const current = employe.post ?? null;

  const choose = (post: ComponentKindId | null) => {
    if (post === current) return;
    // La pièce en cours n'est plus la bonne : l'atelier rend ses ingrédients
    // au prochain tour, et le travail déjà fait passe à la nouvelle pièce.
    dispatch(setPost({ employeId: employe.id, post }));
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-bold">
        {waiting ? (
          <span className="text-warning">
            En attente : il manque{" "}
            {requirementsLabel(recipeToRequirements(waiting))}
          </span>
        ) : job ? (
          <>
            Fabrique : {kindLabel(job.kind)}
            {job.fallback && (
              <span className="text-base-content/60">
                {" "}
                (repli, pour débloquer son poste)
              </span>
            )}
          </>
        ) : (
          <span className="text-base-content/60">Pas de pièce en cours</span>
        )}
      </p>
      <div
        role="radiogroup"
        aria-label="Poste"
        className="flex flex-col gap-1.5"
      >
        <button
          type="button"
          role="radio"
          aria-checked={current === null}
          onClick={() => choose(null)}
          className={
            "flex items-center gap-2 rounded-xl border-2 border-ink px-3 py-1.5 text-left text-sm " +
            (current === null ? "bg-primary" : "bg-white")
          }
        >
          <span className="font-display font-semibold">Auto</span>
          <span className="text-xs text-base-content/70">
            la pièce la plus utile aux contrats et produits en cours
          </span>
        </button>
        {kinds.map((k) => {
          const blocker = craftBlocker(employe, k.id, time, shift);
          const why =
            blocker === "technology"
              ? `${missingTechnology(k.id, time)?.name} · ${missingTechnology(k.id, time)?.year}`
              : blocker === "skill"
                ? `${family} ${TIER_GATE[k.tier] + shift} requis (${Math.floor(
                    employe[
                      family === "Code"
                        ? "codeStat"
                        : family === "Visuel"
                          ? "visualStat"
                          : "uxStat"
                    ] / STAT_SCALE,
                  )})`
                : `${LABOR_DAYS[k.tier]} u. de travail`;
          return (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={current === k.id}
              disabled={blocker !== null}
              onClick={() => choose(k.id)}
              className={
                "grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-left text-sm " +
                (blocker
                  ? "border-dashed border-base-content/30 bg-base-200 text-base-content/60"
                  : current === k.id
                    ? "border-ink bg-primary"
                    : "border-ink bg-white")
              }
            >
              <KindPill kind={k.id} size={18} />
              <span>
                <span className="font-bold">{k.label}</span>
                {k.tier > 1 && (
                  <span className="text-xs text-base-content/70">
                    {" "}
                    ← {requirementsLabel(recipeToRequirements(k.recipe))}
                  </span>
                )}
              </span>
              <span className="text-[11px] font-extrabold whitespace-nowrap">
                {why}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
