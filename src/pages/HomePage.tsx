import { ReactElement, useState } from "react";

import { BuildingEmployeView, useEmployeViewMode } from "@/components/building";
import { TopMenuItem } from "@/data/interface";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { useAppSelector } from "@/data/redux/hooks";
import {
  selectCurrentBuilding,
  selectEmployesByBuilding,
} from "@/data/redux/selectors";
import { EMPLOYE_MODAL_ID, EmployeModal } from "@/components/employe";

const pageTopMenuItems: TopMenuItem[] = [];

/**
 * Vue studio : l'effectif du bâtiment courant. Le bâtiment se choisit depuis
 * le sélecteur du menu du bas (`BuildingSwitcher`), pas ici.
 */
export const HomePage: React.FC = (): ReactElement => {
  useTopMenu(pageTopMenuItems);

  const building = useAppSelector(selectCurrentBuilding);
  const employes = useAppSelector((s) =>
    building == null ? [] : selectEmployesByBuilding(s, building.id),
  );
  const [viewMode, setViewMode] = useEmployeViewMode();
  const [selectedEmployeId, setSelectedEmployeId] = useState<number | null>(
    null,
  );

  const openEmploye = (id: number) => {
    setSelectedEmployeId(id);
    (
      document.getElementById(EMPLOYE_MODAL_ID) as HTMLDialogElement
    )?.showModal();
  };

  return (
    <div className="fixed inset-x-0 top-14 bottom-14 flex flex-col gap-2 p-3 overflow-hidden">
      {/* Effectif du bâtiment sélectionné : occupe l'espace restant de l'Accueil */}
      <div className="flex flex-1 min-h-0 flex-col bg-base-100">
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
            mode={viewMode}
            onMode={setViewMode}
            onSelect={openEmploye}
          />
        )}
      </div>

      <EmployeModal
        employeId={selectedEmployeId}
        onClose={() => setSelectedEmployeId(null)}
      />
    </div>
  );
};
