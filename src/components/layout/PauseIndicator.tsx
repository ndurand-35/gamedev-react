import { useDispatch, useSelector } from "react-redux";
import { Home, Play, Plus } from "iconoir-react";

import { RootState } from "@/data/redux/store";
import { setGameSpeed } from "@/data/redux/engineSlice";
import { Link } from "react-router-dom";

export const PauseIndicator = () => {
    const gameSpeed = useSelector((state: RootState) => state.engine.gameSpeed);
    const dispatch = useDispatch();
    return (
        <>
            {gameSpeed === 0 && (
                <div
                    className="fixed top-0 z-50 flex flex-col space-y-4 items-center justify-center w-screen h-full 
                text-center bg-gray-300 border-8 bg-opacity-60 border-error"
                >
                    <button className="btn btn-primary" onClick={() => dispatch(setGameSpeed(600))}>
                        <Play />
                        Reprendre
                    </button>
                    <Link to="/new-game" className="btn btn-active">
                        <Plus />
                        Nouvelle partie
                    </Link>
                    <Link to="/" className="btn btn-error btn-outline">
                        <Home />
                        Menu Principal
                    </Link>
                </div>
            )}
        </>
    );
};
