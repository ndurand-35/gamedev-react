import { ReactElement, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { RootState } from "@/data/redux/store";
import { generateAvailableContractList } from "@/data/redux/taskSlice";
import { Contract } from "@/data/interface";
import { ContractCard } from "@/components/contract";



export const TaskPage: React.FC = (): ReactElement => {
    const dispatch = useDispatch();

    const availableContractList = useSelector((state: RootState) => state.task.availableContractList);
    const reputation = useSelector((state: RootState) => state.company.reputation);
    const time = useSelector((state: RootState) => state.engine.time);

    const [isMounted, setIsMounted] = useState<Boolean>(false);

    useEffect(() => {
        if (!isMounted) {
            dispatch(generateAvailableContractList({ reputation, time }));
            setIsMounted(true);
        }
    }, [dispatch, reputation, setIsMounted, isMounted]);

    return (
        <div className="p-8 mt-14 mb-20">
            <div className="grid 2xl:grid-cols-4 xl:grid-cols-3 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 grid-cols-1 gap-4">
                {availableContractList.map((aC: Contract) => (
                    <ContractCard contract={aC} />
                ))}
            </div>
        </div>
    );
};
