import { ReactElement, useState } from "react";

import { BuildingEmployeView, useEmployeViewMode } from "@/components/building";
import { TopMenuItem } from "@/data/interface";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { useAppSelector } from "@/data/redux/hooks";
import {
  selectCurrentBuilding,
  selectEmployesByBuilding,
} from "@/data/redux/selectors";
import { EmployeModal } from "@/components/employe";
import { BuildingSidebar } from "@/components/building/BuildingSidebar";
import { CurrentContractsPanel } from "@/components/contract/CurrentContractsPanel";

const pageTopMenuItems: TopMenuItem[] = [];

/**
 * Vue studio : l'effectif du bâtiment courant, et à droite les contrats en
 * cours. Le bâtiment se choisit depuis le sélecteur du menu du bas
 * (`BuildingSwitcher`) et, à partir de deux bâtiments, depuis la colonne de
 * gauche qui signale les alertes de chacun.
 */
export const HomePage: React.FC = (): ReactElement => {
  useTopMenu(pageTopMenuItems);

  const building = useAppSelector(selectCurrentBuilding);
  const buildingCount = useAppSelector((s) => s.company.buildingList.length);
  const employes = useAppSelector((s) =>
    building == null ? [] : selectEmployesByBuilding(s, building.id),
  );
  const [viewMode, setViewMode] = useEmployeViewMode();
  const [selectedEmployeId, setSelectedEmployeId] = useState<number | null>(
    null,
  );

  const openEmploye = (id: number) => setSelectedEmployeId(id);
  const multi = buildingCount >= 2;

  return (
    <div
      className={
        "fixed inset-x-0 top-(--hud-h) bottom-(--dock-h) grid grid-cols-1 gap-4 overflow-hidden px-2 pt-3 pb-2 sm:px-4 " +
        (multi
          ? "md:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_21rem]"
          : "lg:grid-cols-[minmax(0,1fr)_21rem]")
      }
    >
      {/* Sur téléphone, le sélecteur du dock suffit : la colonne écraserait
          l'effectif. */}
      {multi && (
        <div className="hidden min-h-0 md:contents">
          <BuildingSidebar />
        </div>
      )}
      {/* Effectif du bâtiment sélectionné : occupe l'espace restant de l'Accueil.
          Même vide, il s'affiche : ses places libres servent à installer
          quelqu'un. */}
      {/* Le cadre reste crème la nuit, comme sur les autres pages : seul le
          papier autour passe au bleu nuit. */}
      <div className="toy-frame relative flex min-h-0 flex-col">
        {!building ? (
          <p className="m-auto p-8 text-center opacity-70">
            Aucun bâtiment. Achetez-en un depuis SeLoger.
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

      {/* Contrats signés à droite, dès que la largeur le permet ; sinon ils
          restent sur la page Contrats. */}
      <div
        className={"hidden min-h-0 " + (multi ? "xl:contents" : "lg:contents")}
      >
        <CurrentContractsPanel />
      </div>

      <EmployeModal
        employeId={selectedEmployeId}
        onClose={() => setSelectedEmployeId(null)}
      />
    </div>
  );
};
