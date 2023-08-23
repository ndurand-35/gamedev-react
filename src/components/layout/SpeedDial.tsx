import { AddPage, Plus } from "iconoir-react";
import { useState } from "react";

export const SpeedDial = () => {
    const [isHidden, setIsHidden] = useState<Boolean>(true);

    return (
        <div
            data-dial-init
            className="fixed right-12 bottom-24 group"
            onMouseEnter={() => setIsHidden(false)}
            onMouseLeave={() => setIsHidden(true)}
        >
            <div id="speed-dial-menu-default" className={"flex-col items-center mb-4 space-y-2 " + (isHidden ? "hidden" : "flex")}>
                <div className="tooltip tooltip-left" data-tip="Signer un contrat">
                    <button className="btn btn-circle">
                        <AddPage width={24} height={24} />
                    </button>
                </div>
            </div>
            <button className={"btn btn-circle btn-primary group-hover:rotate-45"}>
                <Plus width={32} height={32} />
            </button>
            {/* <button
                type="button"
                data-dial-toggle="speed-dial-menu-default"
                aria-controls="speed-dial-menu-default"
                aria-expanded="false"
                className="flex items-center justify-center text-white bg-blue-700 rounded-full w-14 h-14 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 focus:outline-none dark:focus:ring-blue-800"
            >
                <svg
                    className="w-5 h-5 transition-transform group-hover:rotate-45"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 18 18"
                >
                    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 1v16M1 9h16" />
                </svg>
                <span className="sr-only">Open actions menu</span>
            </button> */}
        </div>
    );
};
