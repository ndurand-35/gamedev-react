import { FC, ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { Building as BuildingIcon, NavArrowUp } from "iconoir-react";

import { setCurrentBuilding } from "@/data/redux/engineSlice";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { selectCurrentBuilding } from "@/data/redux/selectors";
import { BuildingPicker } from "@/components/building/BuildingPicker";

/**
 * Sélecteur de bâtiment du menu du bas : un clic ouvre la liste, un clic sur
 * un bâtiment bascule la vue studio dessus (et y ramène si on est ailleurs).
 * Le dropdown DaisyUI s'ouvre au focus : on le referme en retirant le focus
 * après le choix, sinon la liste resterait affichée par-dessus l'Accueil.
 */
export const BuildingSwitcher: FC = (): ReactElement => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const current = useAppSelector(selectCurrentBuilding);

  const onSelect = (id: number) => {
    dispatch(setCurrentBuilding(id));
    navigate("/game");
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <div className="dropdown dropdown-top">
      <div
        tabIndex={0}
        role="button"
        aria-label="Changer de bâtiment"
        title={current ? `Bâtiment : ${current.name}` : "Bâtiments"}
        className="btn btn-sm btn-ghost gap-1 px-2 max-w-48"
      >
        <BuildingIcon height={20} width={20} />
        {current && (
          <span className="hidden lg:inline text-sm font-normal truncate">
            {current.name}
          </span>
        )}
        <NavArrowUp height={12} width={12} className="opacity-60" />
      </div>
      <div tabIndex={0} className="dropdown-content z-50 mb-2 w-72 shadow-xl">
        <BuildingPicker selectedId={current?.id} onSelect={onSelect} />
      </div>
    </div>
  );
};
