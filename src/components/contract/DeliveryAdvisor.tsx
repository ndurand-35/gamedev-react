import { FC, ReactElement, ReactNode } from "react";

import {
  ComponentQuality,
  ComponentRequirement,
  ConsumedComponent,
  QUALITY_BADGE_CLASS,
  QUALITY_LABELS,
  qualityFromAverage,
} from "@/data/interface";
import {
  DEADLINE_REPUTATION_MALUS,
  DeliveryAdvice,
  DeliveryScenario,
  formatPrice,
} from "@/data/utils";

interface DeliveryAdvisorProps {
  advice: DeliveryAdvice;
  /** Malus facturé si le contrat expire — le coût de ne rien faire. */
  priceMalus: number;
}

/** Délai lisible : on ne compte en heures que le dernier jour. */
const formatDelay = (hours: number): string => {
  if (hours <= 0) return "maintenant";
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days} j`;
  return `${Math.round(days / 30)} mois`;
};

const formatMoney = (amount: number): string => `${formatPrice(amount)} €`;

const formatSignedMoney = (amount: number): string =>
  `${amount >= 0 ? "+" : "−"}${formatPrice(Math.abs(amount))} €`;

/** « Bon (3,2) » — le libellé pour l'œil, la décimale pour l'arbitrage. */
const formatQuality = (average: number): string =>
  `${QUALITY_LABELS[qualityFromAverage(average)]} (${average
    .toFixed(1)
    .replace(".", ",")})`;

const formatMissing = (missing: ComponentRequirement[]): string =>
  missing
    .map(
      (m) =>
        `${m.quantity} ${m.type}` +
        (m.minQuality != null ? ` ≥ ${QUALITY_LABELS[m.minQuality]}` : ""),
    )
    .join(", ");

/** « +2 Très bon, +1 Bon » : ce que la production apporte à cette livraison. */
const formatGained = (gained: ConsumedComponent[]): string | null => {
  if (gained.length === 0) return null;
  const byQuality = new Map<ComponentQuality, number>();
  for (const c of gained) {
    byQuality.set(c.quality, (byQuality.get(c.quality) ?? 0) + 1);
  }
  return [...byQuality.entries()]
    .sort(([a], [b]) => b - a)
    .map(([quality, count]) => `+${count} ${QUALITY_LABELS[quality]}`)
    .join(", ");
};

/** Ce qu'une attente change, en clair : ce qu'elle apporte et ce qu'elle coûte. */
const waitEffects = (now: DeliveryScenario, wait: DeliveryScenario): string[] => {
  const effects: string[] = [];
  const gained = formatGained(wait.gained);
  if (gained) effects.push(gained);
  if (wait.downgraded > 0) {
    effects.push(
      `${wait.downgraded} composant${wait.downgraded > 1 ? "s" : ""} démodé${
        wait.downgraded > 1 ? "s" : ""
      }`,
    );
  }
  if (now.early && !wait.early) effects.push("prime d'avance perdue");
  return effects;
};

interface ScenarioRowProps {
  label: string;
  highlighted: boolean;
  quality?: number;
  detail?: ReactNode;
  amount?: string;
  amountTone?: string;
}

const ScenarioRow: FC<ScenarioRowProps> = ({
  label,
  highlighted,
  quality,
  detail,
  amount,
  amountTone = "",
}): ReactElement => (
  <div
    className={
      "grid grid-cols-[8rem_1fr_auto] items-center gap-2 border-l-2 pl-2 " +
      (highlighted
        ? "border-success"
        : "border-transparent opacity-60")
    }
  >
    <span className={"text-sm " + (highlighted ? "font-semibold" : "")}>
      {label}
    </span>
    <span className="flex flex-row flex-wrap items-center gap-1.5 text-xs">
      {quality != null && (
        <span
          className={`badge badge-xs ${QUALITY_BADGE_CLASS[qualityFromAverage(quality)]}`}
        >
          {formatQuality(quality)}
        </span>
      )}
      {detail && <span className="opacity-70">{detail}</span>}
    </span>
    <span className={"text-sm font-semibold tabular-nums " + amountTone}>
      {amount ?? "—"}
    </span>
  </div>
);

/**
 * Chiffre l'arbitrage que le joueur devait jusqu'ici deviner : livrer
 * maintenant, ou laisser la production remplacer le fond de stock au risque de
 * le voir se démoder et de perdre la prime d'anticipation. Les deux montants
 * sont posés côte à côte, avec l'écart net et ce qui le compose.
 */
export const DeliveryAdvisor: FC<DeliveryAdvisorProps> = ({
  advice,
  priceMalus,
}): ReactElement => {
  const { now, wait, deliverableAt, lastEarlyTime, recommendation } = advice;

  if (recommendation === "blocked") {
    return (
      <div className="rounded-box bg-error/10 border border-error/30 p-3">
        <p className="text-sm font-semibold text-error">
          Non livrable avant la deadline
        </p>
        <p className="text-xs opacity-80 mt-0.5">
          Il manquera {formatMissing(now.missing)} à l'effectif actuel. Sans
          renfort sur ces composants, le contrat expire et coûte{" "}
          {formatMoney(priceMalus)} et{" "}
          {Math.abs(DEADLINE_REPUTATION_MALUS)} points de réputation.
        </p>
      </div>
    );
  }

  const earlyLeft = lastEarlyTime - now.time;
  const waitEffectsLabel = wait ? waitEffects(now, wait).join(" · ") : "";

  return (
    <div className="rounded-box bg-base-200/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-50 mb-2">
        Arbitrage de livraison
      </p>

      <div className="flex flex-col gap-1">
        <ScenarioRow
          label="Livrer maintenant"
          highlighted={recommendation === "deliver"}
          quality={now.deliverable ? now.averageQuality : undefined}
          detail={
            now.deliverable
              ? now.early
                ? earlyLeft > 0
                  ? `prime d'avance +20 % encore ${formatDelay(earlyLeft)}`
                  : "dernière heure pour la prime d'avance"
                : "sans prime d'avance"
              : `impossible — il manque ${formatMissing(now.missing)}`
          }
          amount={now.deliverable ? formatMoney(now.reward) : undefined}
          amountTone={now.deliverable ? "text-success" : "opacity-40"}
        />

        {wait && (
          <ScenarioRow
            label={`Attendre ${formatDelay(wait.waitHours)}`}
            highlighted={recommendation === "wait"}
            quality={wait.averageQuality}
            detail={waitEffectsLabel || "stock inchangé"}
            amount={formatMoney(wait.reward)}
            amountTone={wait.delta > 0 ? "text-success" : "text-base-content"}
          />
        )}
      </div>

      <p className="mt-2 pl-2 text-xs">
        {!now.deliverable && deliverableAt !== null ? (
          <>
            <span className="font-semibold">
              Livrable dans {formatDelay(deliverableAt - now.time)}
            </span>
            {wait && wait.time > deliverableAt && (
              <span className="opacity-70">
                {" "}
                — mais {formatDelay(wait.waitHours)} d'attente rapportent{" "}
                {formatMoney(wait.reward)}
              </span>
            )}
          </>
        ) : wait && wait.delta > 0 ? (
          <span className="font-semibold text-success">
            Attendre rapporte {formatSignedMoney(wait.delta)} net
          </span>
        ) : wait && wait.delta < 0 ? (
          <span className="opacity-70">
            Livrer maintenant : attendre coûterait{" "}
            {formatMoney(Math.abs(wait.delta))}
          </span>
        ) : (
          <span className="opacity-70">
            Livrer maintenant : le stock ne se bonifiera plus
          </span>
        )}
      </p>
    </div>
  );
};
