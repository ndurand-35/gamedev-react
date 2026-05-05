import { ReactElement, useEffect, useState } from "react";
import { Building as BuildingIcon, Xmark } from "iconoir-react";

import { BuildingPicker } from "@/components/building";
import { HomeDashboard, SpeedDial } from "@/components/layout";
import {
  Employe,
  PersonType,
  ProductionPerson,
  TopMenuItem,
} from "@/data/interface";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { useAppSelector } from "@/data/redux/hooks";
import {
  selectBuildingById,
  selectEmployesByBuilding,
} from "@/data/redux/selectors";
import {
  COMPONENT_BTN_CLASS,
  COMPONENT_ICON,
} from "@/components/component";
import { EMPLOYE_MODAL_ID, EmployeModal } from "@/components/employe";

const pageTopMenuItems: TopMenuItem[] = [];

export const HomePage: React.FC = (): ReactElement => {
  useTopMenu(pageTopMenuItems);

  const buildings = useAppSelector((s) => s.company.buildingList);
  const [selectedId, setSelectedId] = useState<number | undefined>(
    buildings[0]?.id,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEmployeId, setSelectedEmployeId] = useState<number | null>(
    null,
  );

  const building = useAppSelector((s) => selectBuildingById(s, selectedId));
  const employes = useAppSelector((s) =>
    selectedId == null ? [] : selectEmployesByBuilding(s, selectedId),
  );

  useEffect(() => {
    if (buildings.length === 0) {
      if (selectedId !== undefined) setSelectedId(undefined);
      return;
    }
    if (selectedId == null || !buildings.find((b) => b.id === selectedId)) {
      setSelectedId(buildings[0].id);
    }
  }, [buildings, selectedId]);

  const handleSelect = (id: number) => {
    setSelectedId(id);
    setDrawerOpen(false);
  };

  const openEmploye = (id: number) => {
    setSelectedEmployeId(id);
    (
      document.getElementById(EMPLOYE_MODAL_ID) as HTMLDialogElement
    )?.showModal();
  };

  return (
    <div className="p-4 mt-14 mb-14 space-y-4">
      <HomeDashboard />

      <div className="flex flex-row items-center gap-3">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="btn btn-primary"
          aria-label="Ouvrir la liste des bâtiments"
        >
          <BuildingIcon height={20} width={20} />
          Bâtiments
        </button>
        {building && (
          <h1 className="text-2xl font-bold truncate">{building.name}</h1>
        )}
      </div>

      {drawerOpen && (
        <>
          <div
            role="presentation"
            onClick={() => setDrawerOpen(false)}
            className="fixed top-14 bottom-14 left-0 right-0 bg-black/40 z-40"
          />
          <aside
            className="fixed top-14 bottom-14 left-0 w-80 max-w-[85vw] bg-base-100 z-50 overflow-y-auto p-4 border-r border-base-content/20 shadow-xl"
            aria-label="Liste des bâtiments"
          >
            <div className="flex flex-row items-center justify-end mb-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="btn btn-sm btn-ghost btn-circle"
                aria-label="Fermer"
              >
                <Xmark />
              </button>
            </div>
            <BuildingPicker
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </aside>
        </>
      )}

      {!building ? (
        <div className="card bg-base-100 border border-base-content/20 p-8 text-center">
          <p className="opacity-70">
            Aucun bâtiment. Achetez-en un depuis SeLoger.
          </p>
        </div>
      ) : (
        <div className="card bg-base-100 border border-base-content/20 p-4">
          <h3 className="font-semibold mb-2">Employés ({employes.length})</h3>
          {employes.length === 0 ? (
            <p className="text-sm opacity-60">
              Aucun employé affecté à ce bâtiment.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {employes.map((emp: Employe) => {
                const prod =
                  emp.personType === PersonType.PROD
                    ? (emp as ProductionPerson)
                    : null;
                const assigned = prod?.assignedComponentType ?? null;
                const AssignedIcon = assigned ? COMPONENT_ICON[assigned] : null;
                return (
                  <div
                    key={`home_employe_${emp.id}`}
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
                      onClick={() => openEmploye(emp.id)}
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
      )}

      <EmployeModal
        employeId={selectedEmployeId}
        onClose={() => setSelectedEmployeId(null)}
      />
      <SpeedDial />
    </div>
  );
};
