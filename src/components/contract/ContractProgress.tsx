import { FC, ReactElement } from "react";
import { useDispatch, useSelector } from "react-redux";

import { NavArrowDown, NavArrowUp } from "iconoir-react";

import { StartedContract } from "@/data/interface";
import { setTaskPriority } from "@/data/redux/taskSlice";
import { hourToDay, hourToWeek } from "@/data/utils";
import { RootState } from "@/data/redux/store";

interface ContractProgressProps {
    contract: StartedContract;
}

export const ContractProgress: FC<ContractProgressProps> = ({ contract }): ReactElement => {
    const dispatch = useDispatch();
    const { time } = useSelector((state: RootState) => state.engine);

    return (
        <div className="flex flex-row items-center space-x-4 px-4 p-2">
            <div className="flex flex-col w-full space-y-1">
                <p>{contract.name}</p>
                <progress className="progress h-4 transition-transform duration-75" value={contract.progression} max="100"></progress>
                <p>
                    {hourToDay((contract.startDate + contract.time) - time)} jour{contract.time > 1 ? "s" : ""}
                </p>
            </div>
            <div className="flex flex-col items-center justify-center">
                <NavArrowUp
                    height={16}
                    className="cursor-pointer hover:text-primary"
                    onClick={() => dispatch(setTaskPriority({ task: contract, priority: contract.priority + 1 }))}
                />
                {contract.priority}
                <NavArrowDown
                    height={16}
                    className={contract.priority === 1 ? "text-gray-300" : "cursor-pointer"}
                    onClick={() =>
                        contract.priority !== 1 && dispatch(setTaskPriority({ task: contract, priority: contract.priority - 1 }))
                    }
                />
            </div>
        </div>
    );
};
