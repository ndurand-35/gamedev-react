import { ReactElement } from "react";
import { useSelector } from "react-redux";

import { RootState } from "@/data/redux/store";
import { Building, Employe } from "@/data/interface";

export const FondateurInfo: React.FC = (): ReactElement => {
    const employeList = useSelector((state: RootState) => state.employe.employeList);
    const buildingList = useSelector((state: RootState) => state.company.buildingList);

    const fondateur: Employe = employeList.filter((e: Employe) => e.id === 1)[0];

    return (
        <>
            <div className="flex flex-row space-x-2">
                <h1>
                    {fondateur.firstName} {fondateur.lastName} -
                </h1>
                <h2> {buildingList.find((b: Building) => b.id == fondateur.buildingId)?.name}</h2>
            </div>
        </>
    );
};
