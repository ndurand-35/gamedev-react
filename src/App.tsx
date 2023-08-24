import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import { createBrowserRouter, RouterProvider } from "react-router-dom";

import type { RootState } from "@/data/redux/store";
import { incrementTime } from "@/data/redux/engineSlice";

import { BottomNavigation, Header, PauseIndicator } from "@/components/layout/index";
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
			element: <HomePage />,
		},
		{
			path: "/employe",
			element: <EmployePage />,
		},
	]);

	return (
		<>
			<Header />
			<RouterProvider router={router} />
			<PauseIndicator />
			<BottomNavigation />
		</>
	);
}

export default App;
