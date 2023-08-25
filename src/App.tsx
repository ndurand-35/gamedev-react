import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { createBrowserRouter, Outlet, RouterProvider } from "react-router-dom";

import type { RootState } from "@/data/redux/store";
import { incrementTime } from "@/data/redux/engineSlice";
import { payMonhlyBilling } from "@/data/redux/companySlice";

import { BottomNavigation, Header, PauseIndicator } from "@/components/layout/index";
import { HomePage, EmployePage, TaskPage } from "@/pages";
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
				{ path: "employe", element: <EmployePage /> },
				{ path: "task", element: <TaskPage /> },
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
