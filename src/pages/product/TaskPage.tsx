import { ReactElement } from "react";

import { useAppSelector } from "@/data/redux/hooks";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { Contract, StartedContract } from "@/data/interface";
import { ContractCard, ContractDelivery } from "@/components/contract";
import { productTopMenuItems } from "@/pages/product/menu";

export const TaskPage: React.FC = (): ReactElement => {
  useTopMenu(productTopMenuItems);

  const availableContractList = useAppSelector(
    (state) => state.task.availableContractList,
  );
  const taskList = useAppSelector((state) => state.task.taskList);

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
              <th>Contrat</th>
              <th>Difficulté</th>
              <th>Délai</th>
              <th className="text-right">Acompte</th>
              <th className="text-right">Solde</th>
              <th className="text-right">Malus</th>
              <th>Composants demandés</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {availableContractList.map((aC: Contract) => (
              <ContractCard contract={aC} key={`contract_${aC.id}`} />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};
