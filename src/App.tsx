import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";

import type { RootState } from "@/data/redux/store";
import { incrementTime } from "@/data/redux/engineSlice";
import { payMonhlyBilling } from "@/data/redux/companySlice";

import { BottomNavigation, Header, PauseIndicator } from "@/components/layout/index";
import { HomePage, EmployePage, TaskPage, BuildingPage, FondateurPage, PoleEmploiPage, EmployeListPage } from "@/pages";
function App() {
	const dispatch = useDispatch();
	const gameSpeed = useSelector((state: RootState) => state.engine.gameSpeed);
	const time = useSelector((state: RootState) => state.engine.time);
	const employeList = useSelector((state: RootState) => state.employe.employeList);

	/* GameLoop */
	useEffect(() => {
		const loop = setInterval(() => {
			if (gameSpeed !== 0) {
				dispatch(payMonhlyBilling({ time, employeList }));
				dispatch(incrementTime());
			}
		}, gameSpeed); // fps

		return () => clearInterval(loop);
	}, [dispatch, gameSpeed, time]);

	const router = createBrowserRouter([
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
				{ path: "building", element: <BuildingPage /> },
			],
		},
	]);

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
