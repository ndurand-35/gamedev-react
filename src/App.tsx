import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";

import type { RootState } from "@/redux/store";
import { incrementTime } from "@/redux/engineSlice";

import { BottomNavigation, Header, PauseIndicator, SpeedDial } from "@/components/layout/index";

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
  }, [gameSpeed]);

  return (
    <>
      <Header />
      {/* <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p> */}
      <PauseIndicator />
      <SpeedDial />
      <BottomNavigation />
    </>
  );
}

export default App;
