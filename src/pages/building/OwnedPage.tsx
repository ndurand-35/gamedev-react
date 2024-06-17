import { BuildingTable } from "@/components/building/BuildingTable";
import { TopMenuItem } from "@/data/interface";
import { setCurrentTopMenu } from "@/data/redux/engineSlice";
import { ReactElement, useEffect, useState } from "react";
import { useDispatch } from "react-redux";

const pageTopMenuItems: TopMenuItem[] = [
    {
        name: "Mes batiments",
        link: "/building/owned",
    },
    {
        name: "SeLoger",
        link: "/building/buy",
    },
];

export const OwnedPage: React.FC = (): ReactElement => {
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
            <BuildingTable />
        </div>
    );
};
