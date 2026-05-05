import { FC, ReactElement, memo, useMemo, useState } from "react";
import {
  Check,
  ClipboardCheck,
  Code,
  ConstrainedSurface,
  PenTablet,
  ReceiveEuros,
  SendEuros,
} from "iconoir-react";

import {
  Building,
  ComponentRequirement,
  Contract,
  ContractType,
  QUALITY_LABELS,
  StartedContract,
} from "@/data/interface";
import { ComponentTypeBadge } from "@/components/component";
import { setMoney } from "@/data/redux/companySlice";
import { acceptContract } from "@/data/redux/taskSlice";
import { removeComponents } from "@/data/redux/componentSlice";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import {
  ASSEMBLY_POINTS_PER_COMPONENT,
  computeAverageQuality,
  hourToWeek,
  selectBestComponents,
  totalRequirementQuantity,
} from "@/data/utils";

interface ContractCardProps {
  contract: Contract;
}

export const ContractCard: FC<ContractCardProps> = memo(
  ({ contract }): ReactElement => {
    const dispatch = useAppDispatch();

    const money = useAppSelector((state) => state.company.money);
    const buildingList = useAppSelector((state) => state.company.buildingList);
    const time = useAppSelector((state) => state.engine.time);
    const stock = useAppSelector((state) => state.component.stock);

    const initialSelection = useMemo(
      () => (buildingList.length > 0 ? [buildingList[0]] : []),
      // initial only — n'écoute pas les changements ultérieurs
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );
    const [selectedBuildings, setSelectedBuildings] =
      useState<Building[]>(initialSelection);

    const selection = useMemo(
      () => selectBestComponents(stock, contract.requirements),
      [stock, contract.requirements],
    );
    const stockOk = selection.missing.length === 0;

    const toggleBuilding = (building: Building) => {
      setSelectedBuildings((prev) =>
        prev.find((b) => b.id === building.id)
          ? prev.filter((b) => b.id !== building.id)
          : [...prev, building],
      );
    };

    const submit = () => {
      if (selectedBuildings.length === 0) return;
      if (!stockOk) return;

      const consumed = selection.consumed;
      const totalQty = totalRequirementQuantity(contract.requirements);

      dispatch(removeComponents(consumed.map((c) => c.id)));
      dispatch(setMoney(money + contract.priceDeposit));

      const newAcceptedContract: StartedContract = {
        ...contract,
        buildingIds: selectedBuildings.map((b) => b.id),
        startDate: time,
        priority: 1,
        progression: 0,
        paused: false,
        consumedComponents: consumed,
        averageQuality: computeAverageQuality(consumed),
        assemblyPoints: totalQty * ASSEMBLY_POINTS_PER_COMPONENT,
      };
      dispatch(acceptContract(newAcceptedContract));
    };

    return (
      <div className="card bg-base-100 shadow-xl">
        <div className="flex flex-col space-y-4 ">
          <div className="flex flex-row space-x-4 p-4 pb-2">
            <div className="avatar">
              <div className="w-16 rounded">
                {contract.type === ContractType.DEV && (
                  <Code width={64} height={64} />
                )}
                {contract.type === ContractType.DESIGN && (
                  <PenTablet width={64} height={64} />
                )}
                {contract.type === ContractType.FULL_STACK && (
                  <ConstrainedSurface width={64} height={64} />
                )}
              </div>
            </div>
            <div>
              <h2 className="card-title">{contract.name}</h2>
              <div className="flex flex-row space-x-2 items-center">
                <p>{contract.clientName}</p>
                <div className="badge badge-neutral">
                  {contract.taskDifficulty}
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-row justify-around px-4">
            <div
              className="flex flex-row items-center space-x-1 tooltip"
              data-tip="Acompte"
            >
              <ReceiveEuros height={24} aria-label="Acompte" />
              <p>{contract.priceDeposit}</p>
            </div>
            <div
              className="flex flex-row items-center space-x-1 text-success tooltip"
              data-tip="Complément de réussite"
            >
              <ClipboardCheck height={16} aria-label="Bonus" />
              <p>{contract.priceAdditional}</p>
            </div>
            <div
              className="flex flex-row items-center space-x-1 text-error tooltip"
              data-tip="Malus d'échec"
            >
              <SendEuros height={24} aria-label="Malus" />
              <p>{contract.priceMalus}</p>
            </div>
          </div>
          <div>
            <hr />
            <table className="table table-xs table-zebra">
              <tbody>
                <tr>
                  <td>Durée</td>
                  <td className="text-center">
                    {hourToWeek(contract.time)} semaine
                    {contract.time > 1 ? "s" : ""}
                  </td>
                </tr>
                {contract.requirements.map((req: ComponentRequirement) => {
                  const available = stock.filter(
                    (c) =>
                      c.type === req.type &&
                      (req.minQuality == null || c.quality >= req.minQuality),
                  ).length;
                  const enough = available >= req.quantity;
                  return (
                    <tr key={`contract_${contract.id}_req_${req.type}`}>
                      <td>
                        <div className="flex flex-row items-center gap-2">
                          <ComponentTypeBadge type={req.type} />
                          {req.minQuality != null && (
                            <span className="badge badge-xs badge-outline">
                              ≥ {QUALITY_LABELS[req.minQuality]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className={
                          enough
                            ? "text-center text-success"
                            : "text-center text-error"
                        }
                      >
                        {available} / {req.quantity}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <hr />
          </div>

          <div className="join w-full p-4 pt-1">
            <details className="dropdown dropdown-top w-full join-item">
              <summary className="select select-sm select-bordered join-item w-full flex items-center space-x-2 cursor-pointer">
                {selectedBuildings.length === 0 && (
                  <span className="opacity-60">Aucun bâtiment</span>
                )}
                {selectedBuildings.map((b: Building) => (
                  <div
                    key={`task_${contract.id}_building_${b.id}`}
                    className="badge badge-ghost"
                  >
                    {b.name}
                  </div>
                ))}
              </summary>
              <ul className="dropdown-content z-1 menu p-2 shadow bg-base-100 rounded-box w-full space-y-1">
                {buildingList.map((b: Building) => {
                  const isSelected = !!selectedBuildings.find(
                    (sB) => sB.id === b.id,
                  );
                  return (
                    <li key={`contract_${contract.id}_building_${b.id}`}>
                      <button
                        type="button"
                        onClick={() => toggleBuilding(b)}
                        className="flex flex-row items-center"
                      >
                        <Check height={18} opacity={isSelected ? 1 : 0} />
                        {b.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </details>
            <button
              onClick={submit}
              disabled={selectedBuildings.length === 0 || !stockOk}
              className="btn btn-primary btn-sm join-item"
              title={!stockOk ? "Stock de composants insuffisant" : undefined}
            >
              Accepter
            </button>
          </div>
        </div>
      </div>
    );
  },
);
