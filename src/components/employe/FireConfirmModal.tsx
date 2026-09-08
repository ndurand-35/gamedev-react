import { FC, useEffect, useMemo, useRef } from "react";
import { FireFlame, WarningTriangle } from "iconoir-react";

import { Employe } from "@/data/interface";
import { PRODUCTION_THRESHOLD } from "@/data/redux/componentSlice";
import { useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";

interface FireConfirmModalProps {
  /** Employés ciblés par le licenciement, ou null quand la modale est fermée. */
  targets: Employe[] | null;
  onConfirm: () => void;
  onClose: () => void;
}

// Modale de confirmation de licenciement (WF-1 / F6). Intercepte les deux points
// de licenciement (bouton 🔥 unitaire et action « Licencier » batch). Affiche
// l'indemnité one-shot (1× salaire/employé), la perte de production en cours, et
// les places de bâtiment libérées. Focus par défaut sur « Annuler », Échap =
// Annuler (comportement natif de <dialog>). Pas de soft-undo.
export const FireConfirmModal: FC<FireConfirmModalProps> = ({
  targets,
  onConfirm,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buildingList = useAppSelector((s) => s.company.buildingList);
  const productionProgress = useAppSelector(
    (s) => s.component.productionProgress,
  );

  // Le fondateur (id===1) est exclu silencieusement : déjà hors sélection via
  // selectEmployesWithoutFondateur et fired(1) est no-op, on garde un filtre
  // défensif. La mention n'est rendue que s'il est réellement présent.
  const fondateurPresent = useMemo(
    () => (targets ?? []).some((e) => e.id === 1),
    [targets],
  );
  const firable = useMemo(
    () => (targets ?? []).filter((e) => e.id !== 1),
    [targets],
  );

  const open = targets !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const isBatch = firable.length > 1;
  const totalSalary = firable.reduce((sum, e) => sum + e.salary, 0);

  // Places de bâtiment libérées, dérivées de buildingId.
  const placesByBuilding = useMemo(() => {
    const map: Record<number, number> = {};
    for (const e of firable) {
      if (e.buildingId !== undefined) {
        map[e.buildingId] = (map[e.buildingId] ?? 0) + 1;
      }
    }
    return map;
  }, [firable]);

  const confirm = () => {
    onConfirm();
    dialogRef.current?.close();
  };

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      role="dialog"
      aria-label="Confirmer le licenciement"
      onClose={onClose}
    >
      <div className="modal-box max-w-md">
        <h3 className="font-bold text-lg flex items-center gap-2 mb-3">
          <WarningTriangle width={20} height={20} className="text-error" />
          {isBatch
            ? `Licencier ${firable.length} employés ?`
            : "Licencier cet employé ?"}
        </h3>

        {firable.length === 1 && (
          <p className="text-sm mb-3">
            {firable[0].firstName} {firable[0].lastName}
          </p>
        )}

        {/* Indemnités. Batch : deux montants distincts, ne pas fusionner. */}
        <div className="space-y-1 text-sm mb-3">
          {isBatch ? (
            <>
              <div className="flex justify-between">
                <span>Indemnités (one-shot)</span>
                <span className="text-error tabular-nums font-medium">
                  −{formatPrice(totalSalary)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Masse salariale (économie)</span>
                <span className="text-success tabular-nums font-medium">
                  −{formatPrice(totalSalary)} / mois
                </span>
              </div>
            </>
          ) : (
            <div className="flex justify-between">
              <span>Indemnité</span>
              <span className="text-error tabular-nums font-medium">
                −{formatPrice(totalSalary)}
              </span>
            </div>
          )}
        </div>

        {/* Impact production en cours. */}
        <div className="space-y-1 text-sm mb-3">
          {firable.map((e) => {
            const progress = productionProgress[e.id] ?? 0;
            const lost = progress > 0;
            const pct = Math.round((progress / PRODUCTION_THRESHOLD) * 100);
            return (
              <div key={e.id} className="flex items-center gap-2">
                {isBatch && (
                  <span className="opacity-70">
                    {e.firstName} {e.lastName} :
                  </span>
                )}
                {lost ? (
                  <span className="text-error">
                    production en cours PERDUE ({pct}%)
                  </span>
                ) : (
                  <span className="text-success">aucune perte</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Places de bâtiment libérées. */}
        {Object.keys(placesByBuilding).length > 0 && (
          <div className="space-y-1 text-sm mb-3">
            {Object.entries(placesByBuilding).map(([id, count]) => {
              const building = buildingList.find((b) => b.id === Number(id));
              return (
                <div key={id} className="opacity-70">
                  {count} place{count > 1 ? "s" : ""} libérée
                  {count > 1 ? "s" : ""} —{" "}
                  {building?.name ?? "bâtiment inconnu"}
                </div>
              );
            })}
          </div>
        )}

        {fondateurPresent && (
          <p className="text-xs opacity-60 mb-2">Fondateur exclu.</p>
        )}

        <p className="text-xs opacity-60 mb-1">
          Action irréversible (pas d'annulation).
        </p>

        <div className="modal-action">
          <form method="dialog">
            {/* Focus par défaut + Échap : « Annuler ». */}
            <button type="submit" className="btn" autoFocus>
              Annuler
            </button>
          </form>
          <button type="button" className="btn btn-error" onClick={confirm}>
            <FireFlame />
            Licencier
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  );
};
