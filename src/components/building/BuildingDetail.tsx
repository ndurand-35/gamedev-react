import { FC, ReactElement, useState } from "react";

import {
  Employe,
  PersonType,
  ProductionPerson,
  StartedContract,
  getBuildingMonthlyCharges,
} from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import { formatPrice } from "@/data/utils";
import {
  selectBuildingById,
  selectEmployesByBuilding,
  selectTasksForBuilding,
} from "@/data/redux/selectors";
import { ContractProgress } from "@/components/contract";
import { EMPLOYE_MODAL_ID, EmployeModal } from "@/components/employe";
import {
  COMPONENT_BTN_CLASS,
  COMPONENT_ICON,
} from "@/components/component";

interface BuildingDetailProps {
  buildingId: number | undefined;
}

export const BuildingDetail: FC<BuildingDetailProps> = ({
  buildingId,
}): ReactElement => {
  const building = useAppSelector((s) => selectBuildingById(s, buildingId));
  const employes = useAppSelector((s) =>
    buildingId == null ? [] : selectEmployesByBuilding(s, buildingId),
  );
  const tasks = useAppSelector((s) =>
    buildingId == null ? [] : selectTasksForBuilding(s, buildingId),
  );
  const [selectedEmployeId, setSelectedEmployeId] = useState<number | null>(
    null,
  );

  const openEmploye = (emp: Employe) => {
    setSelectedEmployeId(emp.id);
    (
      document.getElementById(EMPLOYE_MODAL_ID) as HTMLDialogElement
    )?.showModal();
  };

  if (!building) {
    return (
      <div className="card bg-base-100 border border-base-content/20 p-8 text-center">
        <p className="opacity-70">
          Sélectionnez un bâtiment pour voir ses détails.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card bg-base-100 border border-base-content/20 p-4">
        <h2 className="text-2xl font-bold">{building.name}</h2>
        <p className="text-sm opacity-70">
          {building.address.adr1}, {building.address.city}
        </p>
        <div className="flex flex-wrap gap-4 text-sm mt-2">
          <span>
            {employes.length}/{building.place} places
          </span>
          <span>{tasks.length} contrat(s) actif(s)</span>
        </div>
        <div className="mt-3 pt-3 border-t border-base-content/10">
          <div className="flex flex-row items-center justify-between text-sm">
            <span className="font-semibold">Charges fixes</span>
            <span className="font-semibold text-error tabular-nums">
              {formatPrice(getBuildingMonthlyCharges(building))} / mois
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs opacity-75 mt-1">
            <div className="flex flex-row items-center justify-between">
              <span>Loyer</span>
              <span className="tabular-nums">{formatPrice(building.rent)}</span>
            </div>
            <div className="flex flex-row items-center justify-between">
              <span>Électricité</span>
              <span className="tabular-nums">
                {formatPrice(building.electricity)}
              </span>
            </div>
            <div className="flex flex-row items-center justify-between">
              <span>Internet</span>
              <span className="tabular-nums">
                {formatPrice(building.internet)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-content/20 p-4">
        <h3 className="font-semibold mb-2">Contrats en cours</h3>
        {tasks.length === 0 ? (
          <p className="text-sm opacity-60">Aucun contrat actif.</p>
        ) : (
          <div className="flex flex-col divide-y divide-base-content/10">
            {tasks.map((t: StartedContract) => (
              <div key={`detail_task_${t.id}`}>
                <ContractProgress contract={t} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card bg-base-100 border border-base-content/20 p-4">
        <h3 className="font-semibold mb-2">Employés ({employes.length})</h3>
        {employes.length === 0 ? (
          <p className="text-sm opacity-60">
            Aucun employé affecté à ce bâtiment.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {employes.map((emp: Employe) => {
              const prod =
                emp.personType === PersonType.PROD
                  ? (emp as ProductionPerson)
                  : null;
              const assigned = prod?.assignedComponentType ?? null;
              const AssignedIcon = assigned ? COMPONENT_ICON[assigned] : null;
              return (
                <div
                  key={`detail_employe_${emp.id}`}
                  className="flex items-center gap-2 p-2 rounded border border-base-content/10"
                >
                  <div className="avatar avatar-placeholder">
                    <div className="bg-neutral text-neutral-content rounded-full w-10">
                      <span className="uppercase">
                        {emp.firstName[0]}
                        {emp.lastName[0]}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {emp.firstName} {emp.lastName}
                    </p>
                    <p className="text-xs opacity-70">
                      {prod?.productionType ?? emp.personType}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEmploye(emp)}
                    className={
                      "btn btn-xs gap-1 " +
                      (assigned ? COMPONENT_BTN_CLASS[assigned] : "")
                    }
                  >
                    {AssignedIcon ? (
                      <AssignedIcon width={12} height={12} />
                    ) : null}
                    {assigned ?? (prod ? "Libre" : "Détails")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <EmployeModal
        employeId={selectedEmployeId}
        onClose={() => setSelectedEmployeId(null)}
      />
    </div>
  );
};
