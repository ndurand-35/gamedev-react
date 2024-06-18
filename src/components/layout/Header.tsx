import type { RootState } from "@/data/redux/store";
import { shallowEqual, useSelector } from "react-redux";

import { Coins, Star } from "iconoir-react";
import { TopMenuItem } from "@/data/interface";
import { NavLink } from "react-router-dom";

export const Header = () => {
    const currentTopMenu = useSelector((state: RootState) => state.engine.currentTopMenu, shallowEqual);
    const money = useSelector((state: RootState) => state.company.money, shallowEqual);
    const reputation = useSelector((state: RootState) => state.company.reputation, shallowEqual);

    return (
        <nav className="fixed top-0 left-0 z-20 w-full">
            <div className="flex flex-wrap items-start justify-between mx-auto">
                <div className="flex flex-row">
                    <div
                        className={
                            "flex flex-row items-center p-4 space-x-2 border-base-content border-opacity-20 bg-base-300 border-b border-r " +
                            (money > 0 ? "text-base-content" : "text-error")
                        }
                    >
                        <Coins className="flex w-4 h-4" />
                        <span className="text-sm ">{money}</span>
                    </div>
                    <div className="flex flex-row items-center p-4 space-x-2 text-base-content border-base-content border-opacity-20 bg-base-300 border-b border-r rounded-br">
                        <Star className="flex w-4 h-4" />
                        <span className="text-sm">{reputation}</span>
                    </div>
                </div>
                <div className="md:items-center justify-between items-right flex w-auto md:order-1">
                    <ul className="menu menu-horizontal px-4 border-base-content border-opacity-20 bg-base-300 border-b border-l rounded-bl space-x-4">
                        {currentTopMenu && currentTopMenu.map((menu: TopMenuItem) => (
                            <li key={`topmenu_item_${menu.name}`}>
                                <NavLink className={menu.active ? "active" : ""} to={menu.link} end>
                                    {menu.name}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </nav>
    );
};
