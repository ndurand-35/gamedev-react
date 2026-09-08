import { ReactElement, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { NavArrowLeft } from "iconoir-react";

import { GlobeCanvas } from "@/components/worldmap";
import {
  RevealBanner,
  StudioLockedPopin,
  StudioPreviewPanel,
} from "@/components/worldmap/panels";
import { usePrefersReducedMotion } from "@/components/worldmap/usePrefersReducedMotion";
import { getStudioDef } from "@/data/utils/studios";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { selectStudioStatus } from "@/data/redux/selectors";
import { clearStudioReveal, unlockStudio } from "@/data/redux/studioSlice";
import { useStudioOpenChime } from "@/audio/useStudioOpenChime";

// ── MapMonde — Page d'intégration (MYL-23, Stage 3) ──────────────────────────
// Default export → chargé via `React.lazy` dans `App.tsx` (route /game/worldmap)
// pour que le bundle Three reste hors du chunk principal. Ce module n'est PAS
// ré-exporté par `@/pages` (le barrel tirerait Three dans le jeu principal).
//
// Stage 3 : on branche les panneaux UI (lot Art MYL-21) sur le state réel —
// `selectStudioStatus`, `engine.peakReputation`, `company.money`, thunk
// `unlockStudio` — l'audio d'ouverture (lot Audio MYL-22) via `useStudioOpenChime`,
// et le bandeau de micro-révélation §7 (`studio.pendingReveal` → `clearStudioReveal`).

const CanvasFallback = (): ReactElement => (
  <div className="flex h-full w-full items-center justify-center text-white/60">
    <span className="loading loading-ring loading-lg" />
  </div>
);

const WorldMapPage: React.FC = (): ReactElement => {
  const dispatch = useAppDispatch();
  const reduceMotion = usePrefersReducedMotion();
  // Sting d'ouverture (lot Audio MYL-22) : s'accroche à `studio.pendingReveal`.
  useStudioOpenChime();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? getStudioDef(selectedId) : undefined;

  const status = useAppSelector((s) =>
    selectedId ? selectStudioStatus(s, selectedId) : null,
  );
  const peakReputation = useAppSelector((s) => s.engine.peakReputation);
  const money = useAppSelector((s) => s.company.money);

  const pendingReveal = useAppSelector((s) => s.studio.pendingReveal);
  const revealDef = pendingReveal ? getStudioDef(pendingReveal) : undefined;

  return (
    <div className="relative h-[calc(100vh-8rem)] w-full overflow-hidden bg-gradient-to-b from-slate-950 to-slate-800">
      <div className="absolute left-4 top-4 z-10 flex items-center gap-3">
        <Link to="/game" className="btn btn-sm btn-ghost gap-1 text-white">
          <NavArrowLeft width={18} height={18} />
          Studio
        </Link>
        <h1 className="text-lg font-semibold text-white/90">Carte du monde</h1>
      </div>

      <Suspense fallback={<CanvasFallback />}>
        <GlobeCanvas onSelectStudio={setSelectedId} />
      </Suspense>

      {/* Panneau contextuel du studio sélectionné, branché sur le state réel :
          aperçu carte-postale §4.1 si débloqué, sinon pop-in mécanique §4.2
          (jauge réputation + ligne coût + bouton 3 états → thunk unlockStudio). */}
      {selected && status && (
        <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
          {status === "unlocked" ? (
            <StudioPreviewPanel def={selected} />
          ) : (
            <StudioLockedPopin
              def={selected}
              peakReputation={peakReputation}
              money={money}
              status={status}
              onUnlock={() => dispatch(unlockStudio(selected.id))}
            />
          )}
        </div>
      )}

      {/* Bandeau de micro-révélation §7 — armé par le thunk au déblocage. Variante
          Reduce Motion (fondu sans slide) honorée via le flag du lot globe. */}
      {revealDef?.revealText && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-20 px-4">
          <RevealBanner
            text={revealDef.revealText}
            reduceMotion={reduceMotion}
            onDismiss={() => dispatch(clearStudioReveal())}
          />
        </div>
      )}
    </div>
  );
};

export default WorldMapPage;
