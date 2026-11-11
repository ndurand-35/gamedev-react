import { ReactElement, useMemo, useState } from "react";

import { SortableHeader } from "@/components/SortableHeader";
import {
  Building,
  TopMenuItem,
  getBuildingMonthlyCharges,
} from "@/data/interface";
import { buyBuilding } from "@/data/redux/companySlice";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { formatPrice } from "@/data/utils";
import {
  BuildingSort,
  BuildingSortKey,
  nextBuildingSort,
  sortBuildings,
} from "@/data/utils/building";

const pageTopMenuItems: TopMenuItem[] = [
  { name: "Accueil", link: "/game/building" },
  { name: "Mes bâtiments", link: "/game/building/owned" },
  { name: "SeLoger", link: "/game/building/buy", active: true },
];

export const SelogerPage: React.FC = (): ReactElement => {
  const dispatch = useAppDispatch();
  const money = useAppSelector((state) => state.company.money);
  const availableBuildingList = useAppSelector(
    (state) => state.company.availableBuildingList,
  );
  const [pendingBuyId, setPendingBuyId] = useState<number | null>(null);
  useTopMenu(pageTopMenuItems);

  const [sort, setSort] = useState<BuildingSort | null>(null);
  const toggleSort = (key: BuildingSortKey) =>
    setSort((prev) => nextBuildingSort(prev, key));
  const sortedBuildings = useMemo(
    () => sortBuildings(availableBuildingList, sort),
    [availableBuildingList, sort],
  );
  const headerProps = { sort, onSort: toggleSort };

  const pendingBuilding =
    pendingBuyId == null
      ? null
      : availableBuildingList.find((b: Building) => b.id === pendingBuyId);

  const confirmBuy = () => {
    if (pendingBuyId != null) dispatch(buyBuilding(pendingBuyId));
    setPendingBuyId(null);
  };

  return (
    <div className="p-8 px-16 mt-14 mb-20 space-y-4">
      <h1>{availableBuildingList.length} Annonces</h1>
      <table className="table table-zebra bg-base-100 rounded-box shadow">
        <thead>
          <tr>
            <SortableHeader label="Ville" sortKey="city" {...headerProps} />
            <SortableHeader label="Pays" sortKey="country" {...headerProps} />
            <SortableHeader
              label="Places"
              sortKey="place"
              align="right"
              {...headerProps}
            />
            <SortableHeader
              label="Charges / mois"
              sortKey="charges"
              align="right"
              {...headerProps}
            />
            <SortableHeader
              label="Prix"
              sortKey="price"
              align="right"
              {...headerProps}
            />
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {sortedBuildings.map((b: Building) => (
            <tr key={`available_building_${b.id}`}>
              <td className="font-medium">{b.address.city}</td>
              <td>{b.address.country}</td>
              <td className="tabular-nums text-right">{b.place}</td>
              <td className="tabular-nums text-right text-error">
                <span
                  className="tooltip"
                  data-tip={`Loyer ${formatPrice(b.rent)} · Électricité ${formatPrice(b.electricity)} · Internet ${formatPrice(b.internet)}`}
                >
                  {formatPrice(getBuildingMonthlyCharges(b))}
                </span>
              </td>
              <td className="tabular-nums text-right">
                {formatPrice(b.price)}
              </td>
              <td>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setPendingBuyId(b.id)}
                  disabled={b.price > money}
                >
                  Acheter
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {pendingBuilding && (
        <dialog open className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Confirmer l'achat</h3>
            <p className="py-4">
              Acheter ce bâtiment pour {formatPrice(pendingBuilding.price)} € ?
            </p>
            <div className="modal-action">
              <button className="btn" onClick={() => setPendingBuyId(null)}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={confirmBuy}>
                Confirmer
              </button>
            </div>
          </div>
          <form
            method="dialog"
            className="modal-backdrop"
            onClick={() => setPendingBuyId(null)}
          >
            <button>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
};
