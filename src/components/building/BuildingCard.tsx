import { Buidling } from "@/data/class/building";
import { ReactElement, useState, FC } from "react";

interface BuildingCardProps {
    building: Buidling;
}

export const BuildingCard: FC<BuildingCardProps> = ({ building }): ReactElement => {
    const [activeTab, setActiveTab] = useState<number>(0);
    return (
        <>
            <div className="z-10 -mb-px tabs">
                <a onClick={() => setActiveTab(0)} className={"tab tab-lifted " + (activeTab == 0 && "tab-active")}>
                    {building.name}
                </a>
                <a onClick={() => setActiveTab(1)} className={"tab tab-lifted " + (activeTab == 1 && "tab-active")}>
                    Tab 2
                </a>
                <a onClick={() => setActiveTab(2)} className={"tab tab-lifted " + (activeTab == 2 && "tab-active")}>
                    Tab 3
                </a>
            </div>
            <div className="overflow-x-auto rounded-b-box rounded-tr-box">
                <div
                    className="preview border-base-300 bg-base-100 rounded-b-box rounded-tr-box flex min-h-[6rem] 
    min-w-[18rem] max-w-4xl flex-wrap items-center justify-center gap-2 overflow-x-hidden border p-4"
                ></div>
            </div>
        </>
    );
};
