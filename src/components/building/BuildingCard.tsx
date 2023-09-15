import { ReactElement, useState, FC } from "react";
import { useSelector } from "react-redux";

import { Employe, Building, StartedTask, StartedContract } from "@/data/interface";
import { RootState } from "@/data/redux/store";
import { ContractProgress } from "@/components/contract";

interface BuildingCardProps {
    building: Building;
}

export const BuildingCard: FC<BuildingCardProps> = ({ building }): ReactElement => {
    const employeList = useSelector((state: RootState) => state.employe.employeList);
    const taskList = useSelector((state: RootState) => state.task.taskList);
    const [activeTab, setActiveTab] = useState<number>(0);
    return (
        <>
            <div className="z-10 -mb-px tabs">
                <a onClick={() => setActiveTab(0)} className={"tab tab-lifted border-b-0 " + (activeTab == 0 && "tab-active")}>
                    {building.name}
                </a>
                <a onClick={() => setActiveTab(1)} className={"tab tab-lifted border-b-0 " + (activeTab == 1 && "tab-active")}>
                    Employé
                </a>
                {/* <a
					onClick={() => setActiveTab(2)}
					className={"tab tab-lifted border-b-0 " + (activeTab == 2 && "tab-active")}
				>
					Tab 3
				</a> */}
            </div>
            {activeTab == 0 && (
                <div className="overflow-x-auto border border-base-600 rounded-b-lg rounded-tr-lg">
                    <div className="flex flex-col min-h-[6rem] divide-y">
                        {taskList
                            .filter((task: StartedTask) => task.buildingIds?.includes(building.id))
                            .map((task: StartedTask) => (
                                <div key={`active_task_${task.id}`}>
                                    <ContractProgress contract={task as StartedContract} />
                                </div>
                            ))}
                    </div>
                </div>
            )}
            {activeTab == 1 && (
                <div className="overflow-x-auto border border-base-600 rounded-lg">
                    <div className="flex flex-col space-y-2 min-h-[6rem] p-4">
                        {employeList
                            .filter((employe: Employe) => employe.buildingId == building.id)
                            .map((employe: Employe, index: number) => (
                                <div key={index} className="flex flex-row space-x-2 items-center">
                                    <div className="avatar placeholder">
                                        <div className="bg-neutral-focus text-neutral-content rounded-full w-8">
                                            <span className="text-xs">
                                                {employe.firstName[0]}
                                                {employe.lastName[0]}
                                            </span>
                                        </div>
                                    </div>
                                    <p>
                                        {employe.firstName} {employe.lastName}
                                    </p>
                                </div>
                            ))}
                    </div>
                </div>
            )}
        </>
    );
};
