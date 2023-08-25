import { ReactElement, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { RootState } from "@/data/redux/store";
import { generateContractList } from "@/data/redux/taskSlice";
import { Building, Contract } from "@/data/interface";
import { ClipboardCheck, ReceiveEuros, SendEuros, Timer } from "iconoir-react";

export const TaskPage: React.FC = (): ReactElement => {
    const dispatch = useDispatch();

    const buildingList = useSelector((state: RootState) => state.company.buildingList);
    const availableContractList = useSelector((state: RootState) => state.task.availableContractList);
    const reputation = useSelector((state: RootState) => state.company.reputation);
    const time = useSelector((state: RootState) => state.engine.time);

    const [isMounted, setIsMounted] = useState<Boolean>(false);

    useEffect(() => {
        if (!isMounted) {
            dispatch(generateContractList({ reputation, time }));
            setIsMounted(true);
        }
    }, [dispatch, reputation, setIsMounted, isMounted]);

    return (
        <div className="p-8">
            <div className="grid xl:grid-cols-4 lg:grid-cols-3 md:grid-cols-2 sm:grid-cols-1 grid-cols-1 gap-4">
                {availableContractList.map((aC: Contract) => (
                    <div key={`ac_${aC.id}`} className="card bg-base-100 shadow-xl">
                        <div className="flex flex-col space-y-4 p-4">
                            <div className="flex flex-row space-x-4">
                                <div className="avatar">
                                    <div className="w-16 rounded">
                                        <img src={aC.clientImage} />
                                    </div>
                                </div>
                                <div>
                                    <h2 className="card-title">{aC.name}</h2>
                                    <p>{aC.clientName}</p>
                                </div>
                            </div>
                            <div className="flex flex-row justify-between">
                                <div className="flex flex-row items-center space-x-1 tooltip" data-tip="Durée">
                                    <Timer height={16} />
                                    <p>
                                        {aC.time} semaine{aC.time > 1 ? "s" : ""}
                                    </p>
                                </div>
                                <div className="flex flex-row items-center space-x-1 tooltip" data-tip="Accompte">
                                    <ReceiveEuros height={24} />
                                    <p>{aC.priceDeposit}</p>
                                </div>
                                <div className="flex flex-row items-center space-x-1 text-success tooltip" data-tip="Complement de reussite">
                                    <ClipboardCheck height={16} />
                                    <p>{aC.priceAdditional}</p>
                                </div>
                                <div className="flex flex-row items-center space-x-1 text-error tooltip" data-tip="Malus d'echec">
                                    <SendEuros height={24} />
                                    <p>{aC.priceMalus}</p>
                                </div>
                            </div>
                            <div className="join w-full">
                                <select className="select select-sm select-bordered join-item w-full">
                                    {buildingList.map((b: Building) => (
                                        <option value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                                <button className="btn btn-primary btn-sm join-item">Accepter</button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
