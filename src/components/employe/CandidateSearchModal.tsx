import { FC, useEffect, useRef, useState } from "react";
import { Coins, Search, WarningTriangle } from "iconoir-react";

import { searchCandidates } from "@/data/redux/recruitmentThunks";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";
import {
  SEARCH_CANDIDATE_LIFETIME,
  SEARCH_MAX_CANDIDATES,
  SEARCH_MIN_CANDIDATES,
  SEARCH_ROLES,
  SEARCH_ROLE_LABEL,
  SearchRole,
  computeSearchCost,
} from "@/data/utils/recruitment";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Commande d'une recherche au pôle emploi : le joueur choisit le poste et le
 * nombre de profils à présenter. Résultat instantané, mais la prestation est
 * facturée avant toute embauche (cf. `computeSearchCost`).
 */
export const CandidateSearchModal: FC<Props> = ({ open, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dispatch = useAppDispatch();
  const money = useAppSelector((s) => s.company.money);
  const reputation = useAppSelector((s) => s.company.reputation);

  const [role, setRole] = useState<SearchRole>(SEARCH_ROLES[0]);
  const [count, setCount] = useState<number>(3);

  const cost = computeSearchCost(role, count, reputation);
  const cantAfford = money < cost;

  // Même pilotage que les autres modales du jeu : <dialog> natif ouvert /
  // fermé impérativement depuis la prop, backdrop daisyUI pour la sortie.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const launch = () => {
    const result = dispatch(searchCandidates({ role, count }));
    if (result.ok) onClose();
  };

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box space-y-4">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Search width={20} height={20} /> Lancer une recherche
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">Poste recherché</span>
            <select
              aria-label="Poste recherché"
              className="select select-bordered select-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as SearchRole)}
            >
              {SEARCH_ROLES.map((r) => (
                <option key={r} value={r}>
                  {SEARCH_ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs opacity-70">
              Profils à présenter ({SEARCH_MIN_CANDIDATES}–
              {SEARCH_MAX_CANDIDATES})
            </span>
            <input
              aria-label="Profils à présenter"
              type="number"
              className="input input-bordered input-sm tabular-nums"
              min={SEARCH_MIN_CANDIDATES}
              max={SEARCH_MAX_CANDIDATES}
              value={count}
              onChange={(e) =>
                setCount(
                  Math.max(
                    SEARCH_MIN_CANDIDATES,
                    Math.min(
                      SEARCH_MAX_CANDIDATES,
                      Math.floor(Number(e.target.value) || 0),
                    ),
                  ),
                )
              }
            />
          </label>
        </div>

        <div className="flex items-center justify-between rounded-box bg-base-200 px-4 py-3">
          <span className="flex items-center gap-2 text-sm">
            <Coins width={18} height={18} /> Frais de recherche
          </span>
          <span
            className={
              "text-lg font-semibold tabular-nums " +
              (cantAfford ? "text-error" : "")
            }
          >
            {formatPrice(cost)}
          </span>
        </div>

        {cantAfford && (
          <div className="alert alert-warning py-2 text-sm">
            <WarningTriangle width={18} height={18} />
            <span>
              Trésorerie insuffisante — il manque {formatPrice(cost - money)}.
            </span>
          </div>
        )}

        <p className="text-xs opacity-60">
          Résultat immédiat. Les frais sont dus quel que soit le nombre
          d'embauches derrière et s'ajoutent au salaire négocié. Un poste
          spécialisé et un gros volume coûtent plus cher ; la réputation allège
          la note. Les profils ramenés restent disponibles{" "}
          {Math.round(SEARCH_CANDIDATE_LIFETIME / 24)} jours.
        </p>

        <div className="modal-action">
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary gap-1"
            onClick={launch}
            disabled={cantAfford}
            aria-disabled={cantAfford}
          >
            <Search width={16} height={16} /> Rechercher pour {formatPrice(cost)}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
};
