import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

import { STUDIO_DEFS } from "@/data/utils/studios";
import { playStudioPinSelect } from "@/audio/sfx";

import { StudioPin } from "@/components/worldmap/StudioPin";
import { usePrefersReducedMotion } from "@/components/worldmap/usePrefersReducedMotion";

// ── MapMonde — Globe 3D R3F (MYL-19, Stage 2) ────────────────────────────────
// Rendu TOTALEMENT découplé du `gameLoopMiddleware` / `gameSpeed` : R3F gère son
// propre RAF (frameloop) et le démonte à la sortie de page — aucun lien avec la
// vitesse de jeu. La sélection/survol sont locaux (éphémères, non persistés) ;
// l'id sélectionné est remonté au parent pour le futur câblage des panneaux UI
// (lot Art Director MYL-21, branché au Stage 3).
//
// Reduced-motion (§7) : sans préférence, le globe « vit » (auto-rotation douce
// + inertie) → `frameloop="always"`, son RAF propre. Avec préférence, on coupe
// le glissé caméra et l'inertie et on bascule en `frameloop="demand"` : rendu
// uniquement à l'interaction, plus aucune animation continue.

// Globe .glb (lot Asset MYL-20) — déjà bâti au rayon GLOBE_RADIUS (1.5) et calé
// sur la convention `latLonToVec3`, donc drop-in direct de l'ex-sphère placeholder.
const GLOBE_URL = "/assets/worldmap/globe.glb";

function Globe() {
  const { scene } = useGLTF(GLOBE_URL);
  // Clone par instance : `useGLTF` met la scène en cache, on évite de muter le
  // graphe partagé (sécurité si la page est montée/démontée plusieurs fois).
  const globe = useMemo(() => scene.clone(true), [scene]);
  return <primitive object={globe} />;
}
useGLTF.preload(GLOBE_URL);

export interface GlobeCanvasProps {
  /** Remonte l'id du studio sélectionné (ou `null`) au parent (Stage 3 UI). */
  onSelectStudio?: (id: string | null) => void;
}

export function GlobeCanvas({ onSelectStudio }: GlobeCanvasProps) {
  const reduceMotion = usePrefersReducedMotion();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const select = (next: string | null) => {
    // Feedback léger optionnel (MYL-22) : seulement à la sélection d'un pin,
    // pas à la déselection (clic dans le vide) — discret, UX §4.2.
    if (next) playStudioPinSelect();
    setSelectedId(next);
    onSelectStudio?.(next);
  };

  return (
    <Canvas
      frameloop={reduceMotion ? "demand" : "always"}
      camera={{ position: [0, 0, 4.2], fov: 45 }}
      dpr={[1, 2]}
      onPointerMissed={() => select(null)}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 3, 5]} intensity={1.1} />
      <directionalLight position={[-4, -2, -3]} intensity={0.35} />

      {/* Globe .glb + pins .glb (lot Asset MYL-20). `Suspense` interne au Canvas :
          le temps du chargement glTF, on ne rend rien en 3D (le fallback DOM de la
          page couvre l'attente initiale). */}
      <Suspense fallback={null}>
        <Globe />

        {STUDIO_DEFS.map((def) => (
          <StudioPin
            key={def.id}
            def={def}
            selected={selectedId === def.id}
            hovered={hoveredId === def.id}
            onSelect={(id) => select(selectedId === id ? null : id)}
            onHover={setHoveredId}
          />
        ))}
      </Suspense>

      {/* Zoom continu monde⇄pin (pas de vue région, UX §3.x) ; pan désactivé. */}
      <OrbitControls
        enablePan={false}
        enableDamping={!reduceMotion}
        autoRotate={!reduceMotion}
        autoRotateSpeed={0.35}
        minDistance={2.1}
        maxDistance={7}
      />
    </Canvas>
  );
}

export default GlobeCanvas;
