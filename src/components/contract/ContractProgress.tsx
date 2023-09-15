import { FC, ReactElement } from "react";
import { useDispatch } from "react-redux";

import { Contract } from "@/data/interface";
import { setTaskPriority } from "@/data/redux/taskSlice";
import { NavArrowDown, NavArrowUp } from "iconoir-react";

interface ContractProgressProps {
    contract: Contract;
}

export const ContractProgress: FC<ContractProgressProps> = ({ contract }): ReactElement => {
    const dispatch = useDispatch();

    return (
        <div className="flex flex-row items-center space-x-4 px-4 p-2">
            <div className="flex flex-col w-full space-y-1">
                <p>{contract.name}</p>
                <progress className="progress h-4" value="45" max="100"></progress>
                <p>
                    {contract.time} semaine{contract.time > 1 ? "s" : ""}
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
                    onClick={() => contract.priority !== 1 && dispatch(setTaskPriority({ task: contract, priority: contract.priority - 1 }))}
                />
            </div>
        </div>
    );
};
