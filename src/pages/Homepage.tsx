import { BuildingList } from "@/components/building";
import { SpeedDial } from "@/components/layout";
import { ReactElement } from "react";

export const HomePage: React.FC = (): ReactElement => {
    return (
        <div className="p-8 mt-14 mb-20">
            <BuildingList />
            <SpeedDial />
        </div>
    );
};
