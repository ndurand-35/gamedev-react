import { FC, ReactElement, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Check, ClipboardCheck, Code, ConstrainedSurface, PenTablet, ReceiveEuros, SendEuros, Timer } from "iconoir-react";

import { Building, Contract, ContractType, StartedContract } from "@/data/interface";
import { RootState } from "@/data/redux/store";
import { setMoney } from "@/data/redux/companySlice";
import { acceptContract } from "@/data/redux/taskSlice";
import { getTimeAsDate, hourToWeek } from "@/data/utils";

interface ContractCardProps {
    contract: Contract;
}

export const ContractCard: FC<ContractCardProps> = ({ contract }): ReactElement => {
    const dispatch = useDispatch();

    const { money, buildingList } = useSelector((state: RootState) => state.company);
    const { time } = useSelector((state: RootState) => state.engine);

    const [selectedBuildings, setSelectedBuildings] = useState<Building[]>([buildingList[0]]);

    const selectBuilding = (building: Building) => {
        setSelectedBuildings([...selectedBuildings, building]);
    };
    const deselectBuilding = (building: Building) => {
        setSelectedBuildings(selectedBuildings.filter((b: Building) => b.id !== building.id));
    };

    const submit = () => {
        dispatch(setMoney(money + contract.priceDeposit));
        let newAcceptedContract: StartedContract = {
            ...contract,
            buildingIds: selectedBuildings.map((b: Building) => b.id),
            startDate: time,
            priority: 1,
            progression: 0,
            paused: false,
        };
        dispatch(acceptContract(newAcceptedContract));
    };

    return (
        <div key={`ac_${contract.id}`} className="card bg-base-100 shadow-xl">
            <div className="flex flex-col space-y-4 ">
                <div className="flex flex-row space-x-4 p-4 pb-2">
                    <div className="avatar">
                        <div className="w-16 rounded">
                            {contract.type === ContractType.DEV && <Code width={64} height={64} />}
                            {contract.type === ContractType.DESIGN && <PenTablet width={64} height={64} />}
                            {contract.type === ContractType.FULL_STACK && <ConstrainedSurface width={64} height={64} />}
                        </div>
                    </div>
                    <div>
                        <h2 className="card-title">{contract.name}</h2>
                        <div className="flex flex-row space-x-2 items-center">
                            <p>{contract.clientName}</p>
                            <div className="badge badge-neutral">{contract.taskDifficulty}</div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-row justify-around px-4">
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
                <div>
                    <hr />
                    <table className="table table-xs table-zebra">
                        <tbody>
                            <tr>
                                <td>Durée</td>
                                <td colSpan={3} className="text-center">{hourToWeek(contract.time)} semaine{contract.time > 1 ? "s" : ""}</td>
                            </tr>
                            {contract.type !== ContractType.DESIGN && (
                                <>
                                    <tr>
                                        <td>Développement </td>
                                        <td className="text-primary">{contract.backNeed}</td>
                                        <td className="text-secondary">{contract.frontNeed}</td>
                                        <td className="text-accent">{contract.backNeed}</td>
                                    </tr>
                                </>
                            )}
                            {contract.type !== ContractType.DEV && (
                                <>
                                    <tr>
                                        <td>Design</td>
                                        <td className="text-primary">{contract.creativityNeed}</td>
                                        <td className="text-secondary">{contract.visualDesignNeed}</td>
                                        <td className="text-accent">{contract.animationNeed}</td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                    <hr />
                </div>

                {/* {contract.type !== ContractType.DESIGN && (
                    <div className="flex flex-row justify-around">
                        <div className="avatar placeholder tooltip" data-tip="BackEnd">
                            <div className="bg-primary text-neutral-content w-8 rounded-full">
                                <span className="text-xs">{contract.backNeed}</span>
                            </div>
                        </div>
                        <div className="avatar placeholder tooltip" data-tip="FrontEnd">
                            <div className="bg-secondary text-neutral-content w-8 rounded-full">
                                <span className="text-xs">{contract.frontNeed}</span>
                            </div>
                        </div>
                        <div className="avatar placeholder tooltip" data-tip="Debug">
                            <div className="bg-accent text-neutral-content w-8 rounded-full">
                                <span className="text-xs">{contract.debugNeed}</span>
                            </div>
                        </div>
                    </div>
                )}
                {contract.type !== ContractType.DEV && (
                    <div className="flex flex-row justify-around">
                        <div className="avatar placeholder tooltip" data-tip="Créativité">
                            <div className="bg-primary text-neutral-content w-8 rounded-full">
                                <span className="text-xs">{contract.creativityNeed}</span>
                            </div>
                        </div>
                        <div className="avatar placeholder tooltip" data-tip="Visuel">
                            <div className="bg-secondary text-neutral-content w-8 rounded-full">
                                <span className="text-xs">{contract.visualDesignNeed}</span>
                            </div>
                        </div>
                        <div className="avatar placeholder tooltip" data-tip="Animation">
                            <div className="bg-accent text-neutral-content w-8 rounded-full">
                                <span className="text-xs">{contract.animationNeed}</span>
                            </div>
                        </div>
                    </div>
                )} */}

                <div className="join w-full p-4 pt-1">
                    <div className="dropdown dropdown-bottom dropdown-end w-full join-item">
                        <div className="select select-sm select-bordered join-item w-full flex items-center space-x-2" tabIndex={0}>
                            {selectedBuildings.map((b: Building) => (
                                <div key={`task_${contract.id}_building_${b.id}`} className="badge badge-ghost">
                                    {b.name}
                                </div>
                            ))}
                        </div>
                        <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-full space-y-1">
                            {buildingList.map((b: Building) => (
                                <li key={`contract_${contract.id}_building_${b.id}`}>
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
                    <hr />
                    <button onClick={submit} className="btn btn-primary btn-sm join-item">
                        Accepter
                    </button>
                </div>
            </div>
        </div>
    );
};
