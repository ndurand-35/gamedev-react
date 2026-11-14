import { InterviewOverlay } from "@/components/employe/InterviewOverlay";
import { useEffect } from "react";
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from "react-router-dom";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { setGameSpeed } from "@/data/redux/engineSlice";
import { normalizeGameSpeed } from "@/data/utils/constant";
import { useGameShortcuts } from "@/data/hooks/useGameShortcuts";
import { useStudioOpenChime } from "@/audio/useStudioOpenChime";
import { useAudioDirector } from "@/audio/useAudioDirector";
import { useGameSounds } from "@/audio/useGameSounds";

import {
  BottomNavigation,
  DecisionModal,
  GameOverIndicator,
  Header,
  PauseIndicator,
  RescueLoanModal,
  ToastContainer,
  TutorialSpotlight,
} from "@/components/layout/index";
import {
  HomePage,
  EmployePage,
  TaskPage,
  BuildingPage,
  PoleEmploiPage,
  DossierPage,
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
import { useDayCycle } from "@/data/hooks/useDayCycle";
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
      {
        path: "/game/employe/recruit/:dossierId",
        element: <DossierPage />,
      },
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
  // Son de l'interface et musique de fond, menu principal compris.
  useAudioDirector();
  return <RouterProvider router={router} />;
}

function Game() {
  const dispatch = useAppDispatch();
  const gameName = useAppSelector((state) => state.engine.gameName);
  const gameSpeed = useAppSelector((state) => state.engine.gameSpeed);

  // MapMonde §7 / Audio (MYL-22) : sting de succès au déblocage d'un studio,
  // accroché au hook `studio.pendingReveal` du Stage 1. Monté ici (niveau jeu)
  // pour sonner quelle que soit la page d'où part l'ouverture.
  useStudioOpenChime();
  // Notifications, décisions en attente, faillite.
  useGameSounds();

  useEffect(() => {
    dispatch(setGameSpeed(normalizeGameSpeed(gameSpeed)));
    return () => {
      dispatch(setGameSpeed(0));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Raccourcis clavier, configurables dans Paramètres → Touches.
  useGameShortcuts();
  // Ambiance jour / nuit selon l'heure de jeu.
  useDayCycle();

  if (gameName === undefined) {
    return <Navigate to="/" replace />;
  }

  return (
    <div>
      <Header />
      <Outlet />
      <PauseIndicator />
      <InterviewOverlay />
      <DecisionModal />
      <RescueLoanModal />
      <GameOverIndicator />
      <ToastContainer />
      <TutorialSpotlight />
      <BottomNavigation />
    </div>
  );
}

export default App;
