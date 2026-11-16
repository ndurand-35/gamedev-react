import { FC, ReactElement } from "react";

import {
  DEADLINE_REPUTATION_MALUS,
  DeliveryAdvice,
  formatPrice,
  requirementsLabel,
} from "@/data/utils";

interface DeliveryAdvisorProps {
  advice: DeliveryAdvice;
  /** Heure de jeu courante. */
  time: number;
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

/**
 * Où en est un contrat signé, d'après l'atelier rejoué sur l'avenir (chaînes
 * de fabrication comprises) : livrable maintenant, dans combien de temps, ou
 * pas avant la deadline. Attendre ne rapporte rien : seule la prime
 * d'anticipation se joue.
 */
export const DeliveryAdvisor: FC<DeliveryAdvisorProps> = ({
  advice,
  time,
  priceMalus,
}): ReactElement => {
  const { deliverableAt, lastEarlyTime, recommendation, missing, reward } =
    advice;

  if (recommendation === "blocked") {
    return (
      <div className="rounded-box border border-error/30 bg-error/10 p-3">
        <p className="text-sm font-semibold text-error">
          Non livrable avant la deadline
        </p>
        <p className="mt-0.5 text-xs opacity-80">
          Il manque {requirementsLabel(missing)}, et l'atelier n'y arrivera pas
          à temps. Sans renfort (ou sans quelqu'un au seuil de compétence), le
          contrat expire et coûte {formatMoney(priceMalus)} et{" "}
          {Math.abs(DEADLINE_REPUTATION_MALUS)} points de réputation.
        </p>
      </div>
    );
  }

  const earlyLeft = lastEarlyTime - time;

  return (
    <div className="rounded-box bg-base-200/60 p-3">
      <p className="mb-1 text-[11px] font-semibold tracking-wide uppercase opacity-50">
        Prévision de livraison
      </p>
      {recommendation === "deliver" ? (
        <p className="text-sm">
          <span className="font-semibold text-success">
            Livrable maintenant : {formatMoney(reward ?? 0)}
          </span>
          <span className="opacity-70">
            {earlyLeft > 0
              ? ` — prime d'avance +20 % encore ${formatDelay(earlyLeft)}`
              : " — sans prime d'avance"}
          </span>
        </p>
      ) : (
        <p className="text-sm">
          <span className="font-semibold">
            Livrable dans {formatDelay((deliverableAt ?? time) - time)}
          </span>
          <span className="opacity-70">
            {" "}
            ({formatMoney(reward ?? 0)}
            {advice.early
              ? ", prime d'avance comprise"
              : ", sans prime d'avance"}
            ). Il manque encore {requirementsLabel(missing)}.
          </span>
        </p>
      )}
    </div>
  );
};
