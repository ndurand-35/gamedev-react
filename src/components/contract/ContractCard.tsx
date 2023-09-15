import { FC, ReactElement, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Check, ClipboardCheck, ReceiveEuros, SendEuros, Timer } from "iconoir-react";

import { Building, Contract } from "@/data/interface";
import { RootState } from "@/data/redux/store";
import { setMoney } from "@/data/redux/companySlice";
import { acceptContract } from "@/data/redux/taskSlice";

interface ContractCardProps {
    contract: Contract;
}

export const ContractCard: FC<ContractCardProps> = ({ contract }): ReactElement => {
    const dispatch = useDispatch();

    const money = useSelector((state: RootState) => state.company.money);
    const buildingList = useSelector((state: RootState) => state.company.buildingList);

    const [selectedBuildings, setSelectedBuildings] = useState<Building[]>([buildingList[0]]);

    const selectBuilding = (building: Building) => {
        setSelectedBuildings([...selectedBuildings, building]);
    };
    const deselectBuilding = (building: Building) => {
        setSelectedBuildings(selectedBuildings.filter((b: Building) => b.id !== building.id));
    };
    const submit = () => {
        dispatch(setMoney(money + contract.priceDeposit));
        dispatch(acceptContract({ acceptedContract: contract, buildingIds: selectedBuildings.map((b: Building) => b.id) }));
    };

    return (
        <div key={`ac_${contract.id}`} className="card bg-base-100 shadow-xl">
            <div className="flex flex-col space-y-4 p-4">
                <div className="flex flex-row space-x-4">
                    <div className="avatar">
                        <div className="w-16 rounded">
                            <img src={contract.clientImage} />
                        </div>
                    </div>
                    <div>
                        <h2 className="card-title">{contract.name}</h2>
                        <p>{contract.clientName}</p>
                    </div>
                </div>
                <div className="flex flex-row justify-between">
                    <div className="flex flex-row items-center space-x-1 tooltip" data-tip="Durée">
                        <Timer height={16} />
                        <p>
                            {contract.time} semaine{contract.time > 1 ? "s" : ""}
                        </p>
                    </div>
                    <div className="flex flex-row items-center space-x-1 tooltip" data-tip="Accompte">
                        <ReceiveEuros height={24} />
                        <p>{contract.priceDeposit}</p>
                    </div>
                    <div className="flex flex-row items-center space-x-1 text-success tooltip" data-tip="Complement de reussite">
                        <ClipboardCheck height={16} />
                        <p>{contract.priceAdditional}</p>
                    </div>
                    <div className="flex flex-row items-center space-x-1 text-error tooltip" data-tip="Malus d'echec">
                        <SendEuros height={24} />
                        <p>{contract.priceMalus}</p>
                    </div>
                </div>

                <div className="join w-full">
                    <div className="dropdown dropdown-bottom dropdown-end w-full">
                        <div className="select select-sm select-bordered join-item w-full flex items-center space-x-2" tabIndex={0}>
                            {selectedBuildings.map((b: Building) => (
                                <div className="badge badge-ghost">{b.name}</div>
                            ))}
                        </div>
                        <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full space-y-1">
                            {buildingList.map((b: Building) => (
                                <li>
                                    {selectedBuildings.find((sB: Building) => sB.id == b.id) ? (
                                        <a onClick={() => deselectBuilding(b)}>
                                            <Check height={18} /> {b.name}{" "}
                                        </a>
                                    ) : (
                                        <a onClick={() => selectBuilding(b)}>
                                            <Check height={18} opacity={0} /> {b.name}
                                        </a>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <button onClick={submit} className="btn btn-primary btn-sm join-item">
                        Accepter
                    </button>
                </div>
            </div>
        </div>
    );
};
