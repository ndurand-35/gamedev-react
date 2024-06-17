import { ReactElement, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setCurrentTopMenu } from "@/data/redux/engineSlice";
import { Building, TopMenuItem } from "@/data/interface";
import { generateCompanyList } from "@/data/redux/companySlice";
import { RootState } from "@/data/redux/store";
import { Coins, Community, SendEuros } from "iconoir-react";
import { formatPrice } from "@/data/utils";

const pageTopMenuItems: TopMenuItem[] = [
    {
        name: "Mes batiments",
        link: "/building/owned",
    },
    {
        name: "SeLoger",
        link: "/building/buy",
        active: true,
    },
];

export const SelogerPage: React.FC = (): ReactElement => {
    const dispatch = useDispatch();
    const [isMounted, setIsMounted] = useState<Boolean>(false);

    const reputation = useSelector((state: RootState) => state.company.reputation);
    const time = useSelector((state: RootState) => state.engine.time);
    const availableBuildingList = useSelector((state: RootState) => state.company.availableBuildingList);

    useEffect(() => {
        if (!isMounted) {
            dispatch(generateCompanyList({ reputation, time }));
            dispatch(setCurrentTopMenu(pageTopMenuItems));
            setIsMounted(true);
        }
    }, [dispatch, setIsMounted, isMounted]);

    return (
        <div className="p-8 px-16 mt-14 mb-20 space-y-4">
            {availableBuildingList &&
                <>
                    <h1>{availableBuildingList.length} Annonces</h1>
                    <div className="grid 2xl:grid-cols-4 xl:grid-cols-3 lg:grid-cols-2 md:grid-cols-2 sm:grid-cols-1 grid-cols-1 gap-4">
                        {availableBuildingList.map((b: Building) => {
                            return (
                                <div className="card bg-base-100 shadow-xl">
                                    <figure>
                                        <img src={b?.image ?? ""} />
                                    </figure>
                                    <div className="card-body pb-4 space-y-1">
                                        <p>{b.address.city} - {b.address.country}</p>
                                        <h2 className="card-title">
                                            {formatPrice(b.price)}
                                            <Coins className="flex w-6 h-6" />
                                        </h2>
                                        <div className="flex flex-row justify-between">
                                            <div className="flex flex-row items-center space-x-1 text-info tooltip" data-tip="Espace">
                                                <Community height={24} />
                                                <p>{b.place}</p>
                                            </div>
                                            <div className="flex flex-row items-center space-x-1 text-error tooltip" data-tip="Charges">
                                                <SendEuros height={24} />
                                                <p>{b.energyPrice}</p>
                                            </div>
                                        </div>
                                        <div className="card-actions justify-end">
                                            <button className="btn btn-primary">Acheter</button>
                                        </div>
                                    </div>
                                </div>
                                // <div className="flex flex-row rounded border" key={`available_building_${b.id}`}>
                                //     <img className="w-64 rounded-l" src={b.image} />
                                //     <div className="py-4 px-8 flex flex-col justify-between">
                                //         <div>
                                //             <p>{b.name}</p>
                                //             <div className="flex flex-row items-center space-x-2">
                                //                 <h1>{formatPrice(b.price)} </h1>
                                //                 <Coins className="flex w-6 h-6" />
                                //             </div>
                                //         </div>

                                //     </div>
                                // </div>
                            );
                        })}
                    </div>
                </>}
        </div>
    );
};
