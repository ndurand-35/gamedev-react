import { SectionTabs } from "@/components/layout/SectionTabs";
import { ReactElement, useMemo, useState } from "react";

import { SortableHeader } from "@/components/SortableHeader";
import { useAppSelector } from "@/data/redux/hooks";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { Contract, StartedContract } from "@/data/interface";
import {
  ContractCard,
  ContractDelivery,
  ContractTile,
} from "@/components/contract";
import { useMediaQuery } from "@/data/hooks/useMediaQuery";
import { CodexLink } from "@/components/codex/CodexLink";
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
  const buildings = useAppSelector((state) => state.company.buildingList);
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
          buildings,
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
    buildings,
  ]);

  const [sort, setSort] = useState<ContractSort | null>(null);

  const toggleSort = (key: ContractSortKey) =>
    setSort((prev) => nextContractSort(prev, key));

  const sortedContracts = useMemo(
    () => sortContracts(availableContractList, sort),
    [availableContractList, sort],
  );

  const headerProps = { sort, onSort: toggleSort };
  // Le tableau demande la largeur d'un grand écran (point `xl`) ; en
  // dessous, des tuiles. Une seule vue rendue, pour une seule cible du tutoriel.
  const wide = useMediaQuery("(min-width: 80rem)");
  const sortValue = sort ? `${sort.key}:${sort.direction}` : "";

  return (
    <div className="page-shell">
      <SectionTabs items={productTopMenuItems} ariaLabel="Section Production" />
      <div className="toy-frame page-frame space-y-8">
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
            Contrats en cours
            <span className="rounded-full border-2 border-ink bg-base-200 px-2 font-sans text-sm font-extrabold">
              {taskList.length}
            </span>
            <CodexLink id="contrats" />
          </h2>
          {taskList.length === 0 ? (
            <p className="rounded-[0.9rem] border-2 border-dashed border-base-content/25 p-4 text-center text-sm font-bold text-base-content/60">
              Aucun contrat signé.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {taskList.map((t: StartedContract) => (
                <ContractDelivery contract={t} key={`started_${t.id}`} />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
              Contrats disponibles
              <span className="rounded-full border-2 border-ink bg-base-200 px-2 font-sans text-sm font-extrabold">
                {sortedContracts.length}
              </span>
            </h2>
            {/* Sans en-têtes de colonnes, le tri passe par une liste. */}
            {!wide && (
              <label className="flex items-center gap-2 rounded-full bg-white py-1 pr-1 pl-3 text-xs font-extrabold">
                Trier par
                <select
                  className="select select-xs w-auto rounded-full border-0 bg-base-200 [--input-color:transparent]"
                  value={sortValue}
                  onChange={(e) => {
                    const [key, direction] = e.target.value.split(":");
                    setSort(
                      key
                        ? {
                            key: key as ContractSortKey,
                            direction: direction as "asc" | "desc",
                          }
                        : null,
                    );
                  }}
                >
                  <option value="">Arrivée</option>
                  <option value="additional:desc">Solde</option>
                  <option value="deposit:desc">Acompte</option>
                  <option value="time:asc">Délai</option>
                  <option value="difficulty:asc">Difficulté</option>
                  <option value="requirements:asc">Composants</option>
                  <option value="malus:asc">Malus</option>
                </select>
              </label>
            )}
          </div>
          {!wide ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedContracts.map((aC: Contract) => (
                <ContractTile
                  contract={aC}
                  leadTimeHours={leadTimeById?.get(aC.id)}
                  key={`contract_${aC.id}`}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <SortableHeader
                      label="Contrat"
                      sortKey="name"
                      {...headerProps}
                    />
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
                    <SortableHeader
                      label="Délai"
                      sortKey="time"
                      {...headerProps}
                    />
                    {canEstimate && (
                      <th>
                        <span
                          className="tooltip tooltip-bottom cursor-help"
                          data-tip="Délai estimé"
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
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
