import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";

import type { RootState } from "@/data/redux/store";
import { incrementTime } from "@/data/redux/engineSlice";

import {
  BottomNavigation,
  Header,
  PauseIndicator,
} from "@/components/layout/index";
import { HomePage } from "@/pages/Homepage";
import { EmployePage } from "@/pages/EmployePage";

function App() {
  const dispatch = useDispatch();
  const gameSpeed = useSelector((state: RootState) => state.engine.gameSpeed);

  /* GameLoop */
  useEffect(() => {
    const loop = setInterval(() => {
      if (gameSpeed !== 0) {
        dispatch(incrementTime());
      }
    }, gameSpeed); // fps

    return () => clearInterval(loop);
  }, [dispatch, gameSpeed]);

  const router = createBrowserRouter([
    {
      path: "/",
      element: <Root />,
      children: [
        {
          path: "/",
          element: <HomePage />,
        },
        {
          path: "employe",
          element: <EmployePage />,
        },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}

function Root() {
  return (
    <>
      <Header />
      <Outlet />
      <PauseIndicator />
      <BottomNavigation />
    </>
  );
}

export default App;
