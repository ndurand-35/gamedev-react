import { ReactElement, useMemo, useState } from "react";

import { SortableHeader } from "@/components/SortableHeader";
import { useAppSelector } from "@/data/redux/hooks";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { Contract, StartedContract } from "@/data/interface";
import { ContractCard, ContractDelivery } from "@/components/contract";
import { productTopMenuItems } from "@/pages/product/menu";
import {
  ContractSort,
  ContractSortKey,
  nextContractSort,
  sortContracts,
} from "@/data/utils/task";
import { estimateContractLeadTime } from "@/data/utils/deliveryAdvisor";
import { FOUNDER_ID, hasFounderSkill } from "@/data/utils/research";

export const TaskPage: React.FC = (): ReactElement => {
  useTopMenu(productTopMenuItems);

  const availableContractList = useAppSelector(
    (state) => state.task.availableContractList,
  );
  const taskList = useAppSelector((state) => state.task.taskList);

  // Estimation de délai : compétence du fondateur, jamais offerte d'office.
  const acquiredSkills = useAppSelector((state) => state.research.acquired);
  const founderResearching = useAppSelector(
    (state) => state.research.current !== null,
  );
  const canEstimate = hasFounderSkill(acquiredSkills, "contract_estimate");
  const stock = useAppSelector((state) => state.component.stock);
  const employes = useAppSelector((state) => state.employe.employeList);
  const productionProgress = useAppSelector(
    (state) => state.component.productionProgress,
  );
  const time = useAppSelector((state) => state.engine.time);

  const leadTimeById = useMemo(() => {
    if (!canEstimate) return null;
    const producing = founderResearching
      ? employes.filter((e) => e.id !== FOUNDER_ID)
      : employes;
    const map = new Map<number, number | null>();
    for (const contract of availableContractList) {
      map.set(
        contract.id,
        estimateContractLeadTime({
          contract,
          stock,
          employes: producing,
          productionProgress,
          time,
        }),
      );
    }
    return map;
  }, [
    canEstimate,
    founderResearching,
    availableContractList,
    stock,
    employes,
    productionProgress,
    time,
  ]);

  const [sort, setSort] = useState<ContractSort | null>(null);

  const toggleSort = (key: ContractSortKey) =>
    setSort((prev) => nextContractSort(prev, key));

  const sortedContracts = useMemo(
    () => sortContracts(availableContractList, sort),
    [availableContractList, sort],
  );

  const headerProps = { sort, onSort: toggleSort };

  return (
    <div className="p-8 mt-14 mb-20 space-y-8">
      <section className="space-y-2">
        <h2 className="text-xl font-bold">
          Contrats en cours ({taskList.length})
        </h2>
        <div className="bg-base-100 rounded-box shadow">
          {taskList.length === 0 ? (
            <p className="p-4 text-sm opacity-60">
              Aucun contrat signé. Signez un contrat ci-dessous, produisez les
              composants demandés, puis livrez quand le stock vous convient.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-base-content/10">
              {taskList.map((t: StartedContract) => (
                <ContractDelivery contract={t} key={`started_${t.id}`} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Contrats disponibles</h2>
        <table className="table table-zebra bg-base-100 rounded-box shadow">
          <thead>
            <tr>
              <SortableHeader label="Contrat" sortKey="name" {...headerProps} />
              <SortableHeader
                label="Client"
                sortKey="client"
                {...headerProps}
              />
              <SortableHeader
                label="Difficulté"
                sortKey="difficulty"
                {...headerProps}
              />
              <SortableHeader label="Délai" sortKey="time" {...headerProps} />
              {canEstimate && (
                <th>
                  <span
                    className="tooltip tooltip-bottom cursor-help"
                    data-tip="Temps pour réunir les composants avec le stock et l'effectif actuels (compétence du fondateur)"
                  >
                    Estimation
                  </span>
                </th>
              )}
              <SortableHeader
                label="Acompte"
                sortKey="deposit"
                align="right"
                {...headerProps}
              />
              <SortableHeader
                label="Solde"
                sortKey="additional"
                align="right"
                {...headerProps}
              />
              <SortableHeader
                label="Malus"
                sortKey="malus"
                align="right"
                {...headerProps}
              />
              <SortableHeader
                label="Composants demandés"
                sortKey="requirements"
                {...headerProps}
              />
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedContracts.map((aC: Contract) => (
              <ContractCard
                contract={aC}
                leadTimeHours={leadTimeById?.get(aC.id)}
                key={`contract_${aC.id}`}
              />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};
