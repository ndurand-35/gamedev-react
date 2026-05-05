import { ReactElement } from "react";

import { useAppSelector } from "@/data/redux/hooks";
import { Contract } from "@/data/interface";
import { ContractCard } from "@/components/contract";

export const TaskPage: React.FC = (): ReactElement => {
  const availableContractList = useAppSelector(
    (state) => state.task.availableContractList,
  );

  return (
    <div className="p-8 mt-14 mb-20">
      <div className="grid 2xl:grid-cols-4 xl:grid-cols-3 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 grid-cols-1 gap-4">
        {availableContractList.map((aC: Contract) => (
          <ContractCard contract={aC} key={`contract_${aC.id}`} />
        ))}
      </div>
    </div>
  );
};
