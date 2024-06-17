import { ReactElement, useEffect, useState } from "react";

import { PoleEmploye } from "@/components/employe";
import { useDispatch } from "react-redux";
import { setCurrentTopMenu } from "@/data/redux/engineSlice";

import { pageTopMenuItems } from "../EmployePage";

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
