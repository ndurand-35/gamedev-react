import { FC } from "react";
import { LogOut, WarningTriangle } from "iconoir-react";

import {
  BUILDING_RESALE_RATIO,
  Building,
  getBuildingMonthlyCharges,
  getBuildingResaleValue,
} from "@/data/interface";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { formatPrice, releaseEmptyBuilding } from "@/data/utils";
import { Modal } from "@/components/global/Modal";

export interface BuildingReleaseModalProps {
  /** Bâtiment à libérer, ou null quand la modale est fermée. */
  building: Building | null;
  onClose: () => void;
}

// Modale de confirmation avant de se séparer d'un bâtiment. Même contrat que
// FireConfirmModal : `building` pilote l'ouverture (cf. Modal), focus par
// défaut sur « Annuler », Échap = Annuler. Chiffre les deux effets
// de la décision — charges qui cessent (récurrent) et revente (one-shot) —
// séparément, l'un ne se déduit pas de l'autre.
export const BuildingReleaseModal: FC<BuildingReleaseModalProps> = ({
  building,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const employeList = useAppSelector((s) => s.employe.employeList);

  const occupants = building
    ? employeList.filter((e) => e.buildingId === building.id).length
    : 0;
  const charges = building ? getBuildingMonthlyCharges(building) : 0;
  const resale = building ? getBuildingResaleValue(building) : 0;

  const confirm = () => {
    if (!building) return;
    dispatch(releaseEmptyBuilding(building.id));
    onClose();
  };

  return (
    <Modal
      open={building !== null}
      onClose={onClose}
      size="md"
      title="Se séparer de ce bâtiment ?"
      icon={<WarningTriangle width={20} height={20} className="text-warning" />}
      actions={
        <>
          <form method="dialog">
            {/* Focus par défaut + Échap : « Annuler ». */}
            <button type="submit" className="btn" autoFocus>
              Annuler
            </button>
          </form>
          <button
            type="button"
            className="btn btn-warning"
            onClick={confirm}
            disabled={occupants > 0}
          >
            <LogOut />
            Libérer
          </button>
        </>
      }
    >
      {building && (
        <p className="text-sm mb-3">
          {building.name}
          <span className="opacity-60"> · {building.address.city}</span>
        </p>
      )}

      <div className="space-y-1 text-sm mb-3">
        <div className="flex justify-between">
          <span>Charges (économie)</span>
          <span className="text-success tabular-nums font-medium">
            −{formatPrice(charges)} / mois
          </span>
        </div>
        <div className="flex justify-between">
          <span>
            Revente ({Math.round(BUILDING_RESALE_RATIO * 100)} % du prix
            d'achat)
          </span>
          <span
            className={
              "tabular-nums font-medium " +
              (resale > 0 ? "text-success" : "opacity-60")
            }
          >
            {resale > 0 ? `+${formatPrice(resale)}` : "—"}
          </span>
        </div>
      </div>

      {/* Garde-fou visible : le thunk refuse aussi, mais on ne laisse pas
            confirmer une action qui va échouer. */}
      {occupants > 0 && (
        <p className="text-xs text-error mb-2">
          {occupants} employé{occupants > 1 ? "s" : ""} encore sur place :
          réaffectez-les avant de libérer le bâtiment.
        </p>
      )}

      <p className="text-xs opacity-60 mb-1">
        Action irréversible : le bâtiment retourne sur le marché.
      </p>
    </Modal>
  );
};
