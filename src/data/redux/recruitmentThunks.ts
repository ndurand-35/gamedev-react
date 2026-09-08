import { AppDispatch, RootState } from "@/data/redux/store";
import { hire, hireWithOffer } from "@/data/redux/employeSlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import { selectRemainingSlots } from "@/data/redux/selectors";

// ── MYL-18 — Garde-fou recrutement (§6.1) ────────────────────────────────────
// Le plafond d'embauche est CROSS-SLICE (cap = somme des `employeeSlots` des
// studios débloqués vs `employeList.length`) : on ne peut donc pas le faire
// respecter par le reducer `hire`/`hireWithOffer` seul. On encapsule l'embauche
// dans un thunk qui vérifie `selectRemainingSlots > 0` AVANT de dispatcher, et
// refuse clairement quand l'effectif atteint le plafond.
//
// Distinct des places PAR BÂTIMENT (`buildingPlace`, déjà géré par
// `assignBuilding`) : le studio dit *combien* recruter, le bâtiment *où* installer.

const CAP_REACHED_MESSAGE =
  "Plafond d'effectif atteint — ouvre un nouveau studio pour recruter davantage.";

export interface HireResult {
  ok: boolean;
  /** `"cap"` quand l'embauche est refusée faute de place de recrutement. */
  reason?: "cap";
}

const refuseForCap = (dispatch: AppDispatch): HireResult => {
  dispatch(
    pushNotification({ message: CAP_REACHED_MESSAGE, type: "warning" }),
  );
  return { ok: false, reason: "cap" };
};

/**
 * Embauche directe (pôle emploi) sous garde-fou de plafond. Renvoie le résultat
 * pour que l'UI puisse interrompre une sélection multiple proprement.
 */
export const hireCandidate =
  (candidateId: number) =>
  (dispatch: AppDispatch, getState: () => RootState): HireResult => {
    if (selectRemainingSlots(getState()) <= 0) return refuseForCap(dispatch);
    dispatch(hire(candidateId));
    return { ok: true };
  };

/**
 * Embauche après négociation (recrutement enrichi MYL-13) sous le même garde-fou.
 */
export const hireCandidateWithOffer =
  (payload: { candidateId: number; salary: number; moraleDelta: number }) =>
  (dispatch: AppDispatch, getState: () => RootState): HireResult => {
    if (selectRemainingSlots(getState()) <= 0) return refuseForCap(dispatch);
    dispatch(hireWithOffer(payload));
    return { ok: true };
  };
