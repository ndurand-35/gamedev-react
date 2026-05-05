import { ReactElement, useState } from "react";

import {
  Building,
  TopMenuItem,
  getBuildingMonthlyCharges,
} from "@/data/interface";
import { buyBuilding } from "@/data/redux/companySlice";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { Coins, Community, SendEuros } from "iconoir-react";
import { formatPrice } from "@/data/utils";

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
      <div className="grid 2xl:grid-cols-4 xl:grid-cols-3 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 grid-cols-1 gap-4">
        {availableBuildingList.map((b: Building) => (
          <div
            key={`available_building_${b.id}`}
            className="card bg-base-100 shadow-xl"
          >
            <figure>
              <img src={b?.image ?? ""} className="h-18" alt="" />
            </figure>
            <div className="card-body pb-4 space-y-1">
              <p>
                {b.address.city} - {b.address.country}
              </p>
              <h2 className="card-title">
                {formatPrice(b.price)}
                <Coins className="flex w-6 h-6" />
              </h2>
              <div className="flex flex-row justify-between">
                <div
                  className="flex flex-row items-center space-x-1 text-info tooltip"
                  data-tip="Espace"
                >
                  <Community height={24} />
                  <p>{b.place}</p>
                </div>
                <div
                  className="flex flex-row items-center space-x-1 text-error tooltip"
                  data-tip={`Loyer ${formatPrice(b.rent)} · Électricité ${formatPrice(b.electricity)} · Internet ${formatPrice(b.internet)}`}
                >
                  <SendEuros height={24} />
                  <p>{formatPrice(getBuildingMonthlyCharges(b))} / mois</p>
                </div>
              </div>
              <div className="card-actions justify-end">
                <button
                  className="btn btn-primary"
                  onClick={() => setPendingBuyId(b.id)}
                  disabled={b.price > money}
                >
                  Acheter
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

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
