import { ReactElement, useMemo, useState } from "react";

import { SortableHeader } from "@/components/SortableHeader";
import { Modal } from "@/components/global/Modal";
import { SectionTabs } from "@/components/layout/SectionTabs";
import { Building, getBuildingMonthlyCharges } from "@/data/interface";
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
import { buildingTopMenuItems } from "@/pages/building/menu";

export const SelogerPage: React.FC = (): ReactElement => {
  const dispatch = useAppDispatch();
  const money = useAppSelector((state) => state.company.money);
  const availableBuildingList = useAppSelector(
    (state) => state.company.availableBuildingList,
  );
  const [pendingBuyId, setPendingBuyId] = useState<number | null>(null);
  useTopMenu(buildingTopMenuItems);

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
    <div className="page-shell">
      <SectionTabs items={buildingTopMenuItems} ariaLabel="Section Bâtiments" />
      <div className="toy-frame page-frame space-y-5">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          Annonces
          <span className="rounded-full border-2 border-ink bg-base-200 px-2 font-sans text-sm font-extrabold">
            {availableBuildingList.length}
          </span>
        </h1>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <SortableHeader label="Ville" sortKey="city" {...headerProps} />
                <SortableHeader
                  label="Pays"
                  sortKey="country"
                  {...headerProps}
                />
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
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedBuildings.map((b: Building) => (
                <tr key={`available_building_${b.id}`}>
                  <td className="font-extrabold">{b.address.city}</td>
                  <td className="font-semibold text-base-content/70">
                    {b.address.country}
                  </td>
                  <td className="tabular-nums text-right">{b.place}</td>
                  <td className="text-right font-extrabold text-error tabular-nums">
                    <span
                      className="tooltip"
                      data-tip={`Loyer ${formatPrice(b.rent)} · Électricité ${formatPrice(b.electricity)} · Internet ${formatPrice(b.internet)}`}
                    >
                      {formatPrice(getBuildingMonthlyCharges(b))} €
                    </span>
                  </td>
                  <td className="text-right font-extrabold tabular-nums">
                    {formatPrice(b.price)} €
                  </td>
                  <td className="text-right">
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
        </div>
      </div>

      <Modal
        open={pendingBuilding != null}
        onClose={() => setPendingBuyId(null)}
        size="lg"
        title="Confirmer l'achat"
        actions={
          <>
            <button className="btn" onClick={() => setPendingBuyId(null)}>
              Annuler
            </button>
            <button className="btn btn-primary" onClick={confirmBuy}>
              Confirmer
            </button>
          </>
        }
      >
        {pendingBuilding && (
          <p className="py-4">
            Acheter ce bâtiment pour {formatPrice(pendingBuilding.price)} € ?
          </p>
        )}
      </Modal>
    </div>
  );
};
