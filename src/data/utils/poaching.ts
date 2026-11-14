import { Person } from "@/data/interface";
import type { ChoiceEvent } from "@/data/redux/eventsSlice";
import type { AppDispatch, RootState } from "@/data/redux/store";
import { presentChoice } from "@/data/utils/events";
import { formatPrice } from "@/data/utils";
import {
  HOURS_PER_MONTH,
  RAISE_COOLDOWN_GRANTED,
  computeCandidateLevel,
} from "@/data/utils/recruitment";
import { poachMultiplier } from "@/data/utils/traits";
import { FOUNDER_ID } from "@/data/utils/research";
import { getTimeAsDate } from "@/data/utils/time";

// ─────────────────────────────────────────────────────────────────────────────
// Débauchage. Un employé compétent payé sous sa valeur de marché (son salaire
// attendu) intéresse la concurrence : chaque mois, un studio peut lui faire une
// offre. Le joueur a une dernière chance — s'aligner sur l'offre, bien
// au-dessus du marché — ou le laisse partir, avec tout ce qu'on lui a appris.
// Payer ses gens à leur valeur suffit à s'en prémunir.
// ─────────────────────────────────────────────────────────────────────────────

/** Sous-paie tolérée : en deçà, personne n'écoute les chasseurs de têtes. */
export const POACH_UNDERPAY_TOLERANCE = 0.05;
/** Chance mensuelle par point de sous-paie, à niveau maximal. */
export const POACH_CHANCE_PER_UNDERPAY = 0.5;
/** Plafond de la chance mensuelle d'être approché. */
export const POACH_MAX_CHANCE = 0.25;
/** L'offre du concurrent, au-dessus de la valeur de marché de l'employé. */
export const POACH_OFFER_RATIO = 1.3;
/** Moral gagné par l'employé que l'on retient en surenchérissant. */
export const POACH_COUNTER_MORALE = 10;

const round10 = (n: number): number => Math.round(n / 10) * 10;

/** Part de sa valeur de marché qui manque au salaire (0 si bien payé). */
export const underpayRatio = (e: Person): number => {
  const expected = e.expectedSalary ?? e.salary;
  return expected > 0 ? Math.max(0, (expected - e.salary) / expected) : 0;
};

/**
 * Chance mensuelle qu'un concurrent approche cet employé : nulle s'il est payé
 * à sa valeur (à la tolérance près), croissante avec la sous-paie et avec son
 * niveau — on ne débauche pas un débutant. Le fondateur ne part pas.
 */
export const poachChance = (e: Person): number => {
  if (e.id === FOUNDER_ID) return 0;
  const underpay = underpayRatio(e);
  if (underpay <= POACH_UNDERPAY_TOLERANCE) return 0;
  return Math.min(
    POACH_MAX_CHANCE,
    POACH_CHANCE_PER_UNDERPAY *
      underpay *
      computeCandidateLevel(e) *
      poachMultiplier(e),
  );
};

/** Salaire offert par le concurrent : nettement au-dessus du marché. */
export const poachOffer = (e: Person): number =>
  round10(Math.max(e.expectedSalary ?? e.salary, e.salary) * POACH_OFFER_RATIO);

/**
 * L'employé approché ce mois-ci, s'il y en a un : parmi ceux dont le tirage
 * passe, le plus qualifié — c'est lui que la concurrence vise. `roll(p)` est
 * injecté pour les tests.
 */
export const selectPoachTarget = (
  employes: Person[],
  roll: (chance: number) => boolean,
): Person | null => {
  let target: Person | null = null;
  for (const e of employes) {
    const chance = poachChance(e);
    if (chance <= 0 || !roll(chance)) continue;
    if (!target || computeCandidateLevel(e) > computeCandidateLevel(target)) {
      target = e;
    }
  }
  return target;
};

/** La décision : surenchérir (cher) ou le laisser partir. */
export const buildPoachDecision = (
  employe: Person,
  rival: string,
  time: number,
): ChoiceEvent => {
  const name = `${employe.firstName} ${employe.lastName}`;
  const offer = poachOffer(employe);
  const raise = offer - employe.salary;
  const percent = Math.round((raise / Math.max(1, employe.salary)) * 100);
  return {
    id: `poach-${employe.id}-${time}`,
    title: `${rival} veut débaucher ${name}`,
    description: `${rival} propose ${formatPrice(offer)} € / mois à ${name}, payé ${formatPrice(
      employe.salary,
    )} € pour une valeur de marché de ${formatPrice(
      employe.expectedSalary ?? employe.salary,
    )} €. Dernière chance pour le retenir.`,
    severity: "error",
    options: [
      {
        id: "surencherir",
        label: `S'aligner (${formatPrice(offer)} € / mois)`,
        outcomeHint: `+${formatPrice(raise)} € / mois (+${percent} %), moral +${POACH_COUNTER_MORALE}`,
        effects: [
          { kind: "salary", employeId: employe.id, salary: offer },
          { kind: "morale", employeId: employe.id, delta: POACH_COUNTER_MORALE },
          {
            kind: "raiseCooldown",
            employeId: employe.id,
            until: time + RAISE_COOLDOWN_GRANTED * HOURS_PER_MONTH,
          },
        ],
        toast: {
          message: `${name} reste, à ${formatPrice(offer)} € / mois.`,
          type: "success",
        },
      },
      {
        id: "laisser",
        label: "Le laisser partir",
        outcomeHint: `${name} rejoint ${rival}, avec tout son savoir-faire`,
        effects: [{ kind: "leave", employeId: employe.id }],
        toast: {
          message: `${name} quitte le studio pour ${rival}.`,
          type: "error",
        },
      },
    ],
  };
};

/**
 * Tick mensuel, à l'heure de la paie : au plus une offre par mois, et jamais
 * par-dessus une décision déjà ouverte (une demande d'augmentation, par
 * exemple) — le débauchage attendra le mois suivant.
 */
export const processPoachingTick = (
  dispatch: AppDispatch,
  state: RootState,
  roll: (chance: number) => boolean = (chance) => Math.random() < chance,
) => {
  if (state.engine.gameOver ?? false) return;
  if (state.events.pending) return;
  const date = getTimeAsDate(state.engine.time);
  if (!(date.add(1, "day").date() === 1 && date.hour() === 23)) return;

  const target = selectPoachTarget(state.employe.employeList, roll);
  if (!target) return;
  const roster = state.competitor?.roster ?? [];
  const rival =
    roster.length > 0
      ? roster[Math.floor(Math.random() * roster.length)].name
      : "Un studio concurrent";
  presentChoice(
    dispatch,
    state,
    buildPoachDecision(target, rival, state.engine.time),
  );
};
