import { ReactElement, useEffect, useState } from "react";
import { Building as BuildingIcon, Xmark } from "iconoir-react";

import { BuildingEmployeView, BuildingPicker } from "@/components/building";
import { SpeedDial } from "@/components/layout";
import { TopMenuItem } from "@/data/interface";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { useAppSelector } from "@/data/redux/hooks";
import {
  selectBuildingById,
  selectEmployesByBuilding,
} from "@/data/redux/selectors";
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
    <div className="fixed inset-x-0 top-14 bottom-14 flex flex-col gap-2 p-3 overflow-hidden">
      {/* Barre de navigation bâtiment */}
      <div className="flex flex-row items-center gap-3 flex-wrap shrink-0">
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
          <h1 className="text-xl font-bold truncate max-w-[60%]">
            {building.name}
          </h1>
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

      {/* Effectif du bâtiment sélectionné : occupe l'espace restant de l'Accueil */}
      <div className="flex flex-1 min-h-0 flex-col rounded-lg border border-base-content/20 bg-base-100">
        {!building ? (
          <p className="m-auto p-8 text-center opacity-70">
            Aucun bâtiment. Achetez-en un depuis SeLoger.
          </p>
        ) : employes.length === 0 ? (
          <p className="m-auto p-8 text-center text-sm opacity-60">
            Aucun employé affecté à ce bâtiment.
          </p>
        ) : (
          <BuildingEmployeView
            building={building}
            employes={employes}
            onSelect={openEmploye}
          />
        )}
      </div>

      <EmployeModal
        employeId={selectedEmployeId}
        onClose={() => setSelectedEmployeId(null)}
      />
      <SpeedDial />
    </div>
  );
};
