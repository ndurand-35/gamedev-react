import dayjs from "dayjs";

import type { RootState } from "@/redux/store";
import { useSelector, useDispatch } from "react-redux";
import { setGameSpeed } from "@/redux/engineSlice";

import { Timer, Pause, Play, NavArrowRight, FastArrowRight, PiggyBank } from "iconoir-react";

export const BottomNavigation = () => {
    const time = useSelector((state: RootState) => state.engine.time);
    const gameSpeed = useSelector((state: RootState) => state.engine.gameSpeed);
    const dispatch = useDispatch();

    const displayTime = () => {
        let startDate = dayjs("1970-01-01");
        return startDate.add(time, "h").format("DD/MM/YYYY HH[H]");
    };

    return (
        <div className="fixed bottom-0 left-0 z-40 grid w-full h-16 grid-cols-1 px-8 bg-white border-t border-gray-200 md:grid-cols-3 dark:bg-gray-700 dark:border-gray-600">
            <div className="items-center justify-center hidden mr-auto text-gray-500 dark:text-gray-400 md:flex ">
                <div className="flex items-center p-2 border-r">
                    <Timer height={14} width={14} />
                    <span className="ml-1 text-sm">{displayTime()}</span>
                </div>
                <div className="tooltip" data-tip="Mettre en pause">
                    <button
                        onClick={() => dispatch(setGameSpeed(0))}
                        type="button"
                        className={
                            "btn btn-circle btn-sm btn-ghost " +
                            (gameSpeed === 0 && "text-error")
                        }
                    >
                        <Pause height={20} width={20} />
                    </button>
                </div>
                <div className="tooltip" data-tip="Vitesse x1">
                    <button
                        onClick={() => dispatch(setGameSpeed(600))}
                        type="button"
                        className={
                            "btn btn-circle btn-sm btn-ghost " +
                            (gameSpeed === 600 && "text-info")
                        }
                    >
                        <Play height={20} width={20} />
                    </button>
                </div>
                <div className="tooltip" data-tip="Vitesse x2">
                    <button
                        onClick={() => dispatch(setGameSpeed(200))}
                        type="button"
                        className={
                            "btn btn-circle btn-sm btn-ghost " +
                            (gameSpeed === 200 && "text-info")
                        }
                    >
                        <NavArrowRight height={20} width={20} />
                    </button>
                </div>
                <div className="tooltip" data-tip="Vitesse x3">
                    <button
                        onClick={() => dispatch(setGameSpeed(50))}
                        type="button"
                        className={
                            "btn btn-circle btn-sm btn-ghost " +
                            (gameSpeed === 50 && "text-info")
                        }
                    >
                        <FastArrowRight height={20} width={20} />
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-center mx-auto">
                <button
                    data-tooltip-target="tooltip-microphone"
                    type="button"
                    className="p-2.5 group bg-gray-100 rounded-full hover:bg-gray-200 mr-4 dark:bg-gray-600 dark:hover:bg-gray-800"
                >
                    <svg
                        className="w-4 h-4 text-gray-500 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 16 19"
                    >
                        <path d="M15 5a1 1 0 0 0-1 1v3a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a1 1 0 0 0-2 0v3a6.006 6.006 0 0 0 6 6h1v2H5a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2H9v-2h1a6.006 6.006 0 0 0 6-6V6a1 1 0 0 0-1-1Z" />
                        <path d="M9 0H7a3 3 0 0 0-3 3v5a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3V3a3 3 0 0 0-3-3Z" />
                    </svg>
                    <span className="sr-only">Mute microphone</span>
                </button>
                <div
                    id="tooltip-microphone"
                    role="tooltip"
                    className="absolute z-10 invisible inline-block px-3 py-2 text-sm font-medium text-white transition-opacity duration-300 bg-gray-900 rounded-lg shadow-sm opacity-0 tooltip dark:bg-gray-700"
                >
                    Mute microphone
                    <div className="tooltip-arrow" data-popper-arrow></div>
                </div>
                <button
                    data-tooltip-target="tooltip-camera"
                    type="button"
                    className="p-2.5 bg-gray-100 group rounded-full hover:bg-gray-200 mr-4 dark:bg-gray-600 dark:hover:bg-gray-800"
                >
                    <svg
                        className="w-4 h-4 text-gray-500 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 20 14"
                    >
                        <path d="M11 0H2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2Zm8.585 1.189a.994.994 0 0 0-.9-.138l-2.965.983a1 1 0 0 0-.685.949v8a1 1 0 0 0 .675.946l2.965 1.02a1.013 1.013 0 0 0 1.032-.242A1 1 0 0 0 20 12V2a1 1 0 0 0-.415-.811Z" />
                    </svg>
                    <span className="sr-only">Hide camera</span>
                </button>
                <div
                    id="tooltip-camera"
                    role="tooltip"
                    className="absolute z-10 invisible inline-block px-3 py-2 text-sm font-medium text-white transition-opacity duration-300 bg-gray-900 rounded-lg shadow-sm opacity-0 tooltip dark:bg-gray-700"
                >
                    Hide camera
                    <div className="tooltip-arrow" data-popper-arrow></div>
                </div>
                <button
                    data-tooltip-target="tooltip-feedback"
                    type="button"
                    className="p-2.5 bg-gray-100 group rounded-full hover:bg-gray-200 mr-4 dark:bg-gray-600 dark:hover:bg-gray-800"
                >
                    <PiggyBank className="flex w-5 h-5 text-gray-500 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white" />
                    <span className="sr-only">Share feedback</span>
                </button>
                <div
                    id="tooltip-feedback"
                    role="tooltip"
                    className="absolute z-10 invisible inline-block px-3 py-2 text-sm font-medium text-white transition-opacity duration-300 bg-gray-900 rounded-lg shadow-sm opacity-0 tooltip dark:bg-gray-700"
                >
                    Share feedback
                    <div className="tooltip-arrow" data-popper-arrow></div>
                </div>
                <button
                    data-tooltip-target="tooltip-settings"
                    type="button"
                    className="p-2.5 bg-gray-100 group rounded-full mr-4 md:mr-0 hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-800"
                >
                    <svg
                        className="w-4 h-4 text-gray-500 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 20 20"
                    >
                        <path
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M4 12.25V1m0 11.25a2.25 2.25 0 0 0 0 4.5m0-4.5a2.25 2.25 0 0 1 0 4.5M4 19v-2.25m6-13.5V1m0 2.25a2.25 2.25 0 0 0 0 4.5m0-4.5a2.25 2.25 0 0 1 0 4.5M10 19V7.75m6 4.5V1m0 11.25a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5ZM16 19v-2"
                        />
                    </svg>
                    <span className="sr-only">Video settings</span>
                </button>
                <div
                    id="tooltip-settings"
                    role="tooltip"
                    className="absolute z-10 invisible inline-block px-3 py-2 text-sm font-medium text-white transition-opacity duration-300 bg-gray-900 rounded-lg shadow-sm opacity-0 tooltip dark:bg-gray-700"
                >
                    Video settings
                    <div className="tooltip-arrow" data-popper-arrow></div>
                </div>
                <button
                    id="moreOptionsDropdownButton"
                    data-dropdown-toggle="moreOptionsDropdown"
                    type="button"
                    className="p-2.5 bg-gray-100 md:hidden group rounded-full hover:bg-gray-200 dark:bg-gray-600 dark:hover:bg-gray-800"
                >
                    <svg
                        className="w-4 h-4 text-gray-500 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 4 15"
                    >
                        <path d="M3.5 1.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 6.041a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 5.959a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
                    </svg>
                    <span className="sr-only">Show options</span>
                </button>
                <div
                    id="moreOptionsDropdown"
                    className="z-10 hidden bg-white divide-y divide-gray-100 rounded-lg shadow w-44 dark:bg-gray-700 dark:divide-gray-600"
                >
                    <ul className="py-2 text-sm text-gray-700 dark:text-gray-200" aria-labelledby="moreOptionsDropdownButton">
                        <li>
                            <a href="#" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white">
                                Show participants
                            </a>
                        </li>
                        <li>
                            <a href="#" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white">
                                Adjust volume
                            </a>
                        </li>
                        <li>
                            <a href="#" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 dark:hover:text-white">
                                Show information
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
