import { useCallback, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router-dom";

import type { RootState } from "@/data/redux/store";
import { incrementTime, setGameSpeed } from "@/data/redux/engineSlice";
import { payMonthlyBilling } from "@/data/redux/companySlice";
import { generateCandidateList } from "@/data/redux/employeSlice";
import { treatTasks } from "@/data/utils/task";

import { BottomNavigation, Header, PauseIndicator } from "@/components/layout/index";
import {
  HomePage,
  EmployePage,
  TaskPage,
  BuildingPage,
  FondateurPage,
  PoleEmploiPage,
  EmployeListPage,
  SelogerPage,
} from "@/pages";

import { OwnedPage } from "./pages/building/OwnedPage";
import MainMenu from "./pages/start/MainMenu";
import NewGamePage from "./pages/start/NewGamePage";

const router = createBrowserRouter([
  { path: "/", element: <MainMenu /> },
  { path: "/new-game", element: <NewGamePage /> },
  {
    path: "/game",
    element: <Game />,
    children: [
      { path: "/game", element: <HomePage /> },
      // Employe
      { path: "/game/employe", element: <EmployePage /> },
      { path: "/game/employe/me", element: <FondateurPage /> },
      { path: "/game/employe/list", element: <EmployeListPage /> },
      { path: "/game/employe/recruit", element: <PoleEmploiPage /> },
      { path: "/game/task", element: <TaskPage /> },
      //Building
      { path: "/game/building", element: <BuildingPage /> },
      { path: "/game/building/owned", element: <OwnedPage /> },
      { path: "/game/building/buy", element: <SelogerPage /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

function Game() {
  const dispatch = useDispatch();
  const { gameName } = useSelector((state: RootState) => ({ gameName: state.engine.gameName }));
  const state = useSelector((state: RootState) => state);
  if (gameName === undefined) { return <Navigate to="/" replace />; }


  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      dispatch(setGameSpeed(0))
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, []);




  const { gameSpeed, time, reputation, employeList } = useSelector((state: RootState) => ({
    gameSpeed: state.engine.gameSpeed,
    time: state.engine.time,
    reputation: state.company.reputation,
    employeList: state.employe.employeList,
  }));

  /* GameLoop */
  const loopCallback = useCallback(() => {
    if (gameSpeed !== 0) {
      treatTasks(dispatch, state);
      dispatch(payMonthlyBilling({ time, employeList }));
      dispatch(generateCandidateList({ time, reputation }));
      dispatch(incrementTime());
    }
  }, [dispatch, gameSpeed, time, state, reputation]);

  useEffect(() => {
    const loop = setInterval(loopCallback, gameSpeed);
    return () => clearInterval(loop);
  }, [loopCallback, gameSpeed]); // fps

  return (
    <div className="prose-h1:text-2xl prose-h1:font-medium prose-h2:text-2xl">
      <Header />
      <Outlet />
      <PauseIndicator />
      <BottomNavigation />
    </div>
  );
}

export default App;
