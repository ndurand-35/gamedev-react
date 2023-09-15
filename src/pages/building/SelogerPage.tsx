import { ReactElement, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setCurrentTopMenu } from "@/data/redux/engineSlice";
import { Building, TopMenuItem } from "@/data/interface";
import { generateCompanyList } from "@/data/redux/companySlice";
import { RootState } from "@/data/redux/store";

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
        <div className="p-8 mt-14 mb-20">
            <div className="space-y-2">
                {availableBuildingList.map((b: Building) => {
                    return (
                        <div className="flex flex-row space-x-2">
                            <img className="w-64" src="https://shorturl.at/yMSWY" />
                            <p>{b.name}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
