import { ReactElement, useEffect, useState } from "react";

import { BuildingList } from "@/components/building";
import { SpeedDial } from "@/components/layout";
import { TopMenuItem } from "@/data/interface";
import { useDispatch } from "react-redux";
import { setCurrentTopMenu } from "@/data/redux/engineSlice";


const pageTopMenuItems: TopMenuItem[] = [];

export const HomePage: React.FC = (): ReactElement => {
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
            <BuildingList />
            <SpeedDial />
        </div>
    );
};
