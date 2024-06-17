import { ReactElement, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setCurrentTopMenu } from "@/data/redux/engineSlice";
import { TopMenuItem } from "@/data/interface";
import { RootState } from "@/data/redux/store";

export const pageTopMenuItems: TopMenuItem[] = [
    {
        name: "Accueil",
        link: "/employe",
    },
    {
        name: "Fondateur",
        link: "/employe/me",
    },
    {
        name: "Employé",
        link: "/employe/list",
    },
    {
        name: "Pole Emploi",
        link: "/employe/recruit",
    },
];

export const EmployePage: React.FC = (): ReactElement => {
    const dispatch = useDispatch();
    const [isMounted, setIsMounted] = useState<Boolean>(false);

    const buildingList = useSelector((state: RootState) => state.company.buildingList);

    useEffect(() => {
        if (!isMounted) {
            dispatch(setCurrentTopMenu(pageTopMenuItems));
            setIsMounted(true);
        }
    }, [dispatch, setIsMounted, isMounted]);

    return <div className="flex justify-center items-center">
        {buildingList.map(building => {
            return <></>
        })}
    </div>;
};
