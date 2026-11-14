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
        className="btn max-w-56 gap-1 px-2 max-sm:h-12 sm:gap-2 sm:px-3"
      >
        <BuildingIcon height={20} width={20} />
        {current && (
          <span className="hidden lg:inline text-sm truncate">
            {current.name}
          </span>
        )}
        <NavArrowUp
          height={12}
          width={12}
          className="hidden opacity-60 sm:block"
        />
      </div>
      <div
        tabIndex={0}
        className="dropdown-content z-50 mb-2 w-72 max-w-[calc(100vw-1rem)] shadow-xl"
      >
        <BuildingPicker selectedId={current?.id} onSelect={onSelect} />
      </div>
    </div>
  );
};
