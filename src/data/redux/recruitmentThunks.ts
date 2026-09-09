import { AppDispatch, RootState } from "@/data/redux/store";
import {
  addCandidates,
  hire,
  hireWithOffer,
} from "@/data/redux/employeSlice";
import { setMoney } from "@/data/redux/companySlice";
import { generateCandidatesForRole } from "@/data/utils/employe";
import { formatPrice } from "@/data/utils";
import {
  SEARCH_CANDIDATE_LIFETIME,
  SEARCH_MAX_CANDIDATES,
  SEARCH_MIN_CANDIDATES,
  SEARCH_ROLE_LABEL,
  SearchRole,
  computeSearchCost,
} from "@/data/utils/recruitment";
import { pushNotification } from "@/data/redux/notificationSlice";
import { selectRemainingSlots } from "@/data/redux/selectors";

// ── Garde-fou recrutement ───────────────────────────────────────────
// Le plafond d'embauche est CROSS-SLICE (cap = somme des places des bâtiments
// possédés vs `employeList.length`) : on ne peut donc pas le faire respecter par
// le reducer `hire`/`hireWithOffer` seul. On encapsule l'embauche dans un thunk
// qui vérifie `selectRemainingSlots > 0` AVANT de dispatcher, et refuse
// clairement quand l'effectif atteint le plafond.

const CAP_REACHED_MESSAGE =
  "Plafond d'effectif atteint — loue un nouveau bâtiment pour recruter davantage.";

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

// ── Recherche de candidats à la demande (pôle emploi) ───────────────────────
// Le joueur commande un poste et un nombre de profils : le résultat est
// instantané mais la prestation est facturée avant toute embauche. Comme le
// débit est cross-slice (company.money) et que la génération n'est pas pure, on
// passe par un thunk plutôt que par un reducer.

export interface SearchResult {
  ok: boolean;
  /** `"money"` quand la trésorerie ne couvre pas les frais de recherche. */
  reason?: "money";
  /** Montant débité (recherche réussie). */
  cost?: number;
  /** Nombre de profils ramenés. */
  count?: number;
}

export const searchCandidates =
  (payload: { role: SearchRole; count: number }) =>
  (dispatch: AppDispatch, getState: () => RootState): SearchResult => {
    const state = getState();
    const count = Math.max(
      SEARCH_MIN_CANDIDATES,
      Math.min(SEARCH_MAX_CANDIDATES, Math.floor(payload.count)),
    );
    const reputation = state.company.reputation;
    const cost = computeSearchCost(payload.role, count, reputation);
    const money = state.company.money;

    if (money < cost) {
      dispatch(
        pushNotification({
          message: `Recherche impossible : ${formatPrice(
            cost - money,
          )} manquants pour régler les frais du pôle emploi.`,
          type: "warning",
        }),
      );
      return { ok: false, reason: "money" };
    }

    // Échéance posée à la recherche : chaque profil quitte le vivier au bout de
    // `SEARCH_CANDIDATE_LIFETIME` (purge dans la boucle de jeu).
    const expiresAt = state.engine.time + SEARCH_CANDIDATE_LIFETIME;
    dispatch(setMoney(money - cost));
    dispatch(
      addCandidates(
        generateCandidatesForRole(payload.role, count, reputation).map((c) => ({
          ...c,
          expiresAt,
        })),
      ),
    );
    dispatch(
      pushNotification({
        message: `${count} profil${count > 1 ? "s" : ""} « ${
          SEARCH_ROLE_LABEL[payload.role]
        } » ramené${count > 1 ? "s" : ""} pour ${formatPrice(cost)}.`,
        type: "info",
      }),
    );
    return { ok: true, cost, count };
  };
