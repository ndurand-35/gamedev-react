import { Building, PAID_MORALE_BONUS, Person } from "@/data/interface";
import { setMoney } from "@/data/redux/companySlice";
import {
  adjustMorale,
  setBonusCooldown,
  setRaiseCooldown,
  setSalary,
} from "@/data/redux/employeSlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import type { AppDispatch, RootState } from "@/data/redux/store";
import { formatPrice } from "@/data/utils";
import { isProductionPerson } from "@/data/utils/component";
import {
  HOURS_PER_MONTH,
  RAISE_COOLDOWN_GRANTED,
} from "@/data/utils/recruitment";

// ── Moral : ce qui le fait bouger ────────────────────────────────────────────
// Le moral ne savait que monter (+1 à chaque paie) : demandes d'augmentation et
// démissions, pourtant codées, ne pouvaient donc jamais se déclencher. Il a
// maintenant des causes de baisse, toutes liées à un choix du joueur, et deux
// leviers payants pour le remonter.
//
//   Chaque mois, à la paie (cumulatif, en plus du +1 de la paie versée) :
//     • salaire sous les attentes  → −2, ou −4 sous 90 % de l'attendu ;
//     • bâtiment plein             → −2 (on gagne en synergie, on perd en confort) ;
//     • production à l'arrêt       → −2 (ni bureau, ou ni tâche ni formation).
//   Sur le coup :
//     • un collègue licencié       → −5 dans son bâtiment, −2 ailleurs ;
//     • une deadline manquée       → −3 pour toute l'équipe.
//
// Le fondateur est hors système : il ne se paie pas, ne réclame rien et ne
// démissionne pas. Il garde seulement le +1 mensuel d'avant.

const FOUNDER_ID = 1;

export const MORALE_UNDERPAID_PENALTY = 2;
export const MORALE_SEVERELY_UNDERPAID_PENALTY = 4;
/** Sous cette part du salaire attendu, le sous-paiement pèse double. */
export const MORALE_SEVERE_UNDERPAY_RATIO = 0.9;
export const MORALE_CROWDED_PENALTY = 2;
export const MORALE_IDLE_PENALTY = 2;
export const MORALE_FIRING_SAME_BUILDING = 5;
export const MORALE_FIRING_ELSEWHERE = 2;
export const MORALE_MISSED_DEADLINE = 3;

/** Prime ponctuelle : une part du salaire mensuel, effet immédiat. */
export const BONUS_SALARY_SHARE = 0.5;
export const BONUS_MORALE = 10;
/** Une prime trop fréquente devient un dû : délai avant la suivante (mois). */
export const BONUS_COOLDOWN_MONTHS = 3;

/** Augmentation accordée sans attendre la demande : coût permanent. */
export const PROACTIVE_RAISE_RATE = 0.05;
export const PROACTIVE_RAISE_MORALE = 8;

export type MoraleCause = "underpaid" | "crowded" | "idle";

export const MORALE_CAUSE_LABEL: Record<MoraleCause, string> = {
  underpaid: "salaire sous les attentes",
  crowded: "bureaux pleins",
  idle: "production à l'arrêt",
};

export interface MoraleDrift {
  employeId: number;
  /** Variation nette du mois, paie comprise. */
  delta: number;
  causes: MoraleCause[];
}

/** Malus de sous-paiement d'un employé (0 s'il est payé à son attendu). */
export const underpayPenalty = (e: Person): number => {
  const expected = e.expectedSalary ?? e.salary;
  if (expected <= 0 || e.salary >= expected) return 0;
  return e.salary < expected * MORALE_SEVERE_UNDERPAY_RATIO
    ? MORALE_SEVERELY_UNDERPAID_PENALTY
    : MORALE_UNDERPAID_PENALTY;
};

/**
 * Un profil de production qui ne peut rien faire : pas de bureau, ou un bureau
 * mais ni tâche ni formation. QA et marketing agissent sans affectation.
 */
const isIdle = (e: Person): boolean => {
  if (!isProductionPerson(e)) return false;
  if (e.buildingId == null) return true;
  return !e.assignedComponentType && !e.trainingType;
};

/**
 * Variation mensuelle du moral de chaque employé, calculée à la paie. Pure :
 * la boucle de jeu l'applique, les tests la vérifient.
 */
export const computeMonthlyMoraleDrift = (
  employes: Person[],
  buildings: Building[],
): MoraleDrift[] => {
  const occupancy = new Map<number, number>();
  for (const e of employes) {
    if (e.buildingId != null) {
      occupancy.set(e.buildingId, (occupancy.get(e.buildingId) ?? 0) + 1);
    }
  }
  const full = new Set(
    buildings
      .filter((b) => (occupancy.get(b.id) ?? 0) >= b.place)
      .map((b) => b.id),
  );

  return employes.map((e) => {
    if (e.id === FOUNDER_ID) {
      return { employeId: e.id, delta: PAID_MORALE_BONUS, causes: [] };
    }
    const causes: MoraleCause[] = [];
    let delta = PAID_MORALE_BONUS;

    const underpay = underpayPenalty(e);
    if (underpay > 0) {
      delta -= underpay;
      causes.push("underpaid");
    }
    if (e.buildingId != null && full.has(e.buildingId)) {
      delta -= MORALE_CROWDED_PENALTY;
      causes.push("crowded");
    }
    if (isIdle(e)) {
      delta -= MORALE_IDLE_PENALTY;
      causes.push("idle");
    }
    return { employeId: e.id, delta, causes };
  });
};

/**
 * Applique la dérive mensuelle (appelée par la clôture, après la paie) et
 * consigne au journal ce dont l'équipe se plaint — un constat, pas un conseil.
 */
export const processMonthlyMorale = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  const drifts = computeMonthlyMoraleDrift(
    state.employe.employeList,
    state.company.buildingList,
  );
  for (const d of drifts) {
    if (d.delta !== 0) {
      dispatch(adjustMorale({ employeId: d.employeId, delta: d.delta }));
    }
  }

  const unhappy = drifts.filter((d) => d.delta < 0);
  if (unhappy.length === 0) return;
  const counts: Record<MoraleCause, number> = {
    underpaid: 0,
    crowded: 0,
    idle: 0,
  };
  for (const d of unhappy) for (const c of d.causes) counts[c]++;
  const detail = (Object.keys(counts) as MoraleCause[])
    .filter((c) => counts[c] > 0)
    .map((c) => `${MORALE_CAUSE_LABEL[c]} (${counts[c]})`)
    .join(", ");
  dispatch(
    pushNotification({
      message: `Moral en baisse pour ${unhappy.length} employé${unhappy.length > 1 ? "s" : ""} : ${detail}.`,
      type: "warning",
    }),
  );
};

/**
 * Choc d'un licenciement sur ceux qui restent. À dispatcher AVANT `fired` : on
 * lit le bâtiment des partants dans l'état courant.
 */
export const applyFiringShock =
  (firedIds: number[]) => (dispatch: AppDispatch, getState: () => RootState) => {
    const employes = getState().employe.employeList;
    const leaving = new Set(firedIds);
    const buildings = new Set(
      employes
        .filter((e) => leaving.has(e.id) && e.buildingId != null)
        .map((e) => e.buildingId as number),
    );
    let shaken = 0;
    for (const e of employes) {
      if (leaving.has(e.id) || e.id === FOUNDER_ID) continue;
      const near = e.buildingId != null && buildings.has(e.buildingId);
      dispatch(
        adjustMorale({
          employeId: e.id,
          delta: -(near ? MORALE_FIRING_SAME_BUILDING : MORALE_FIRING_ELSEWHERE),
        }),
      );
      shaken++;
    }
    if (shaken > 0) {
      dispatch(
        pushNotification({
          message: `Licenciement : le moral de l'équipe accuse le coup (−${MORALE_FIRING_SAME_BUILDING} dans le même bâtiment, −${MORALE_FIRING_ELSEWHERE} ailleurs).`,
          type: "warning",
        }),
      );
    }
  };

/** Une deadline manquée se paie aussi en interne : toute l'équipe trinque. */
export const applyMissedDeadlineShock = (
  dispatch: AppDispatch,
  state: RootState,
) => {
  for (const e of state.employe.employeList) {
    if (e.id === FOUNDER_ID) continue;
    dispatch(adjustMorale({ employeId: e.id, delta: -MORALE_MISSED_DEADLINE }));
  }
};

/** Montant d'une prime pour cet employé. */
export const bonusCost = (e: Person): number =>
  Math.round(e.salary * BONUS_SALARY_SHARE);

/** Nouveau salaire après une augmentation spontanée (arrondi à la dizaine). */
export const proactiveRaiseSalary = (e: Person): number =>
  Math.ceil((e.salary * (1 + PROACTIVE_RAISE_RATE)) / 10) * 10;

export type MoraleActionBlocker = "founder" | "cooldown" | "money";

/** Pourquoi une prime ne peut pas être versée maintenant. */
export const bonusBlocker = (
  e: Person,
  time: number,
  money: number,
): MoraleActionBlocker | null => {
  if (e.id === FOUNDER_ID) return "founder";
  if (e.bonusCooldownUntil != null && time < e.bonusCooldownUntil) {
    return "cooldown";
  }
  if (money < bonusCost(e)) return "money";
  return null;
};

/** Verse une prime : argent contre moral, tout de suite. */
export const payBonus =
  (employeId: number) =>
  (dispatch: AppDispatch, getState: () => RootState): boolean => {
    const state = getState();
    const e = state.employe.employeList.find((p) => p.id === employeId);
    if (!e) return false;
    const time = state.engine.time;
    if (bonusBlocker(e, time, state.company.money)) return false;

    const cost = bonusCost(e);
    dispatch(setMoney(state.company.money - cost));
    dispatch(adjustMorale({ employeId, delta: BONUS_MORALE }));
    dispatch(
      setBonusCooldown({
        employeId,
        until: time + BONUS_COOLDOWN_MONTHS * HOURS_PER_MONTH,
      }),
    );
    dispatch(
      pushNotification({
        message: `Prime de ${formatPrice(cost)} € versée à ${e.firstName} ${e.lastName} (moral +${BONUS_MORALE}).`,
        type: "success",
      }),
    );
    return true;
  };

/**
 * Augmente un employé sans attendre qu'il le demande : la masse salariale
 * monte pour de bon, le moral aussi, et il ne réclamera rien pendant le délai
 * d'une augmentation accordée.
 */
export const grantProactiveRaise =
  (employeId: number) =>
  (dispatch: AppDispatch, getState: () => RootState): boolean => {
    const state = getState();
    const e = state.employe.employeList.find((p) => p.id === employeId);
    if (!e || e.id === FOUNDER_ID) return false;

    const salary = proactiveRaiseSalary(e);
    dispatch(setSalary({ employeId, salary }));
    dispatch(adjustMorale({ employeId, delta: PROACTIVE_RAISE_MORALE }));
    dispatch(
      setRaiseCooldown({
        employeId,
        until: state.engine.time + RAISE_COOLDOWN_GRANTED * HOURS_PER_MONTH,
      }),
    );
    dispatch(
      pushNotification({
        message: `${e.firstName} ${e.lastName} augmenté·e à ${formatPrice(salary)} € / mois (moral +${PROACTIVE_RAISE_MORALE}).`,
        type: "success",
      }),
    );
    return true;
  };
