import { useEffect } from "react";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { setGameSpeed } from "@/data/redux/engineSlice";
import { GAME_SPEEDS } from "@/data/utils/constant";
import { useStudioOpenChime } from "@/audio/useStudioOpenChime";

import {
  BottomNavigation,
  DecisionModal,
  GameOverIndicator,
  Header,
  NotificationCenter,
  PauseIndicator,
  RescueLoanModal,
  SavePanel,
  ToastContainer,
} from "@/components/layout/index";
import {
  HomePage,
  EmployePage,
  TaskPage,
  BuildingPage,
  PoleEmploiPage,
  EmployeListPage,
  ResearchPage,
  CompetitorPage,
  SelogerPage,
  ComponentPage,
  ProductPage,
  SaveManagerPage,
  FinancePage,
  BankPage,
} from "@/pages";

import { OwnedPage } from "@/pages/building/OwnedPage";
import MainMenu from "@/pages/start/MainMenu";
import NewGamePage from "@/pages/start/NewGamePage";

const router = createBrowserRouter([
  { path: "/", element: <MainMenu /> },
  { path: "/new-game", element: <NewGamePage /> },
  // Chargement depuis l'accueil (MYL-26 §2) : même écran de slots, mode "load".
  // Hors garde <Game> pour rester accessible sans partie en cours.
  { path: "/load", element: <SaveManagerPage mode="load" /> },
  {
    path: "/game",
    element: <Game />,
    children: [
      { path: "/game", element: <HomePage /> },
      { path: "/game/employe", element: <EmployePage /> },
      { path: "/game/employe/list", element: <EmployeListPage /> },
      { path: "/game/employe/recruit", element: <PoleEmploiPage /> },
      { path: "/game/component", element: <ComponentPage /> },
      { path: "/game/product", element: <ProductPage /> },
      { path: "/game/product/contract", element: <TaskPage /> },
      { path: "/game/building", element: <BuildingPage /> },
      { path: "/game/building/owned", element: <OwnedPage /> },
      { path: "/game/building/buy", element: <SelogerPage /> },
      { path: "/game/research", element: <ResearchPage /> },
      { path: "/game/competitor", element: <CompetitorPage /> },
      { path: "/game/finance", element: <FinancePage /> },
      { path: "/game/finance/bank", element: <BankPage /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

// Raccourcis clavier de vitesse, sur `event.code` (position physique de la
// touche) : sur un clavier AZERTY, la rangée du haut sans Maj donne « & é " »
// dans `event.key`, ce qui rendrait 1/2/3 inaccessibles.
const SPEED_SHORTCUTS: Record<string, number> = {
  Digit1: GAME_SPEEDS.X1,
  Numpad1: GAME_SPEEDS.X1,
  Digit2: GAME_SPEEDS.X2,
  Numpad2: GAME_SPEEDS.X2,
  Digit3: GAME_SPEEDS.X3,
  Numpad3: GAME_SPEEDS.X3,
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
};

function Game() {
  const dispatch = useAppDispatch();
  const gameName = useAppSelector((state) => state.engine.gameName);
  const gameSpeed = useAppSelector((state) => state.engine.gameSpeed);
  const gameOver = useAppSelector((state) => state.engine.gameOver);
  const pendingRescue = useAppSelector((state) => state.engine.pendingRescue);
  const pendingDecision = useAppSelector((state) => state.events.pending);
  // Une modale bloquante (décision, prêt de sauvetage, faillite) impose la
  // pause : le clavier ne doit pas pouvoir relancer le jeu par-dessus.
  const speedLocked = gameOver || !!pendingRescue || !!pendingDecision;

  // MapMonde §7 / Audio (MYL-22) : sting de succès au déblocage d'un studio,
  // accroché au hook `studio.pendingReveal` du Stage 1. Monté ici (niveau jeu)
  // pour sonner quelle que soit la page d'où part l'ouverture.
  useStudioOpenChime();

  useEffect(() => {
    dispatch(setGameSpeed(gameSpeed));
    return () => {
      dispatch(setGameSpeed(0));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc") {
        dispatch(setGameSpeed(GAME_SPEEDS.PAUSE));
        return;
      }
      const speed = SPEED_SHORTCUTS[event.code];
      if (speed === undefined || speedLocked) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      dispatch(setGameSpeed(speed));
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, speedLocked]);

  if (gameName === undefined) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="prose-h1:text-2xl prose-h1:font-medium prose-h2:text-2xl">
      <Header />
      <NotificationCenter />
      <Outlet />
      <PauseIndicator />
      <DecisionModal />
      <RescueLoanModal />
      <SavePanel />
      <GameOverIndicator />
      <ToastContainer />
      <BottomNavigation />
    </div>
  );
}

export default App;
