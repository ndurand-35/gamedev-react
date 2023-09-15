import { ReactElement, useEffect, useState } from "react";

import { PoleEmploye } from "@/components/employe";
import { TopMenuItem } from "@/data/interface";
import { useDispatch } from "react-redux";
import { setCurrentTopMenu } from "@/data/redux/engineSlice";

const pageTopMenuItems: TopMenuItem[] = [
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
        active: true,
    },
];

export const PoleEmploiPage: React.FC = (): ReactElement => {
    const dispatch = useDispatch();
    const [isMounted, setIsMounted] = useState<Boolean>(false);

    useEffect(() => {
        if (!isMounted) {
            dispatch(setCurrentTopMenu(pageTopMenuItems));
            setIsMounted(true);
        }
    }, [dispatch, setIsMounted, isMounted]);
    return (
        <div className="p-8 mt-14 mb-20">
            <PoleEmploye />
        </div>
    );
};
