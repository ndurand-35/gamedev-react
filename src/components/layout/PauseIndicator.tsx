import { useDispatch, useSelector } from "react-redux";
import { Play } from "iconoir-react";

import { RootState } from "@/redux/store";
import { setGameSpeed } from "@/redux/engineSlice";


export const PauseIndicator = () => {
    const gameSpeed = useSelector((state: RootState) => state.engine.gameSpeed);
    const dispatch = useDispatch();
    return (
        <>
            {gameSpeed === 0 && (
                <div className="fixed top-0 z-50 flex items-center justify-center w-screen h-full text-center bg-gray-300 border-8 bg-opacity-60 border-error">
                    <button className="btn btn-primary" onClick={() => dispatch(setGameSpeed(600))}>
                        <Play />
                        Reprendre
                    </button>
                </div>
            )}
        </>
    );
};
