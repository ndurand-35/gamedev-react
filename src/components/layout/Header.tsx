import type { RootState } from "@/data/redux/store";
import { useSelector } from "react-redux";

import { Coins, Star } from "iconoir-react";
import { TopMenuItem } from "@/data/interface";
import { NavLink } from "react-router-dom";

export const Header = () => {
    const currentTopMenu = useSelector((state: RootState) => state.engine.currentTopMenu);
    const money = useSelector((state: RootState) => state.company.money);
    const reputation = useSelector((state: RootState) => state.company.reputation);

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
                {/* <div className="flex md:order-2">
                    <button
                        data-collapse-toggle="navbar-sticky"
                        type="button"
                        className="inline-flex items-center justify-center w-10 h-10 p-2 text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 "
                        aria-controls="navbar-sticky"
                        aria-expanded="false"
                    >
                        <span className="sr-only">Open main menu</span>
                        <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 17 14">
                            <path
                                stroke="currentColor"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M1 1h15M1 7h15M1 13h15"
                            />
                        </svg>
                    </button>
                </div> */}
                <div className="md:items-center justify-between items-right flex w-auto md:order-1">
                    <ul className="menu menu-horizontal px-1 border-base-content border-opacity-20 bg-base-300 border-b border-l space-x-4">
                        {currentTopMenu.map((menu: TopMenuItem) => (
                            <li key={`topmenu_item_${menu.name}`}>
                                <NavLink className={menu.active ? "active" : ""} to={menu.link}>
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
