import { useCallback, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";

import type { RootState } from "@/data/redux/store";
import { incrementTime } from "@/data/redux/engineSlice";
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
  { path: "/menu", element: <MainMenu /> },
  { path: "/new-game", element: <NewGamePage /> },
  {
    path: "/",
    element: <Root />,
    children: [

      { path: "/", element: <HomePage /> },
      // Employe
      { path: "employe", element: <EmployePage /> },
      { path: "employe/me", element: <FondateurPage /> },
      { path: "employe/list", element: <EmployeListPage /> },
      { path: "employe/recruit", element: <PoleEmploiPage /> },
      { path: "task", element: <TaskPage /> },
      //Building
      { path: "building", element: <BuildingPage /> },
      { path: "building/owned", element: <OwnedPage /> },
      { path: "building/buy", element: <SelogerPage /> },
    ],
  },
]);


function App() {
  const dispatch = useDispatch();
  const state = useSelector((state: RootState) => state);

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
  


  return <RouterProvider router={router} />;
}

function Root() {
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
