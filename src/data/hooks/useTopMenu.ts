import { useEffect } from "react";
import { TopMenuItem } from "@/data/interface";
import { setCurrentTopMenu } from "@/data/redux/engineSlice";
import { useAppDispatch } from "@/data/redux/hooks";

export const useTopMenu = (items: TopMenuItem[]) => {
  const dispatch = useAppDispatch();
  useEffect(() => {
    dispatch(setCurrentTopMenu(items));
  }, [dispatch, items]);
};
