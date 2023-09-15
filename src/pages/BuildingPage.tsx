import { ReactElement, useEffect, useState } from "react";
import { useDispatch } from "react-redux";

import { setCurrentTopMenu } from "@/data/redux/engineSlice";
import { TopMenuItem } from "@/data/interface";

const pageTopMenuItems: TopMenuItem[] = [
    {
        name: "Mes batiments",
        link: "/building/owned",
    },
    {
        name: "Agence",
        link: "/building/buy",
    },
];

export const BuildingPage: React.FC = (): ReactElement => {
    const dispatch = useDispatch();
    const [isMounted, setIsMounted] = useState<Boolean>(false);

    useEffect(() => {
        if (!isMounted) {
            dispatch(setCurrentTopMenu(pageTopMenuItems));
            setIsMounted(true);
        }
    }, [dispatch, setIsMounted, isMounted]);

    return <div className="flex justify-center items-center"></div>;
};
