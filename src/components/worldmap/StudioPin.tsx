import { useMemo } from "react";
import { Html, useGLTF } from "@react-three/drei";
import { Mesh, MeshStandardMaterial, Quaternion, Vector3 } from "three";

import { useAppSelector } from "@/data/redux/hooks";
import { selectStudioStatus } from "@/data/redux/selectors";
import { latLonToVec3, type StudioDef } from "@/data/utils/studios";

import { GLOBE_RADIUS } from "@/components/worldmap/globeConfig";

// ── MapMonde — Marqueur d'un studio sur le globe (MYL-19 / swap asset MYL-23) ─
// Un pin par studio, posé via `latLonToVec3` (contrat Stage 1). Lit le statut
// réel (`selectStudioStatus`) → allumé (ouvert) / éteint (verrouillé ou ouvrable
// non ouvert). Émet select/hover ; l'état vit en local dans `GlobeCanvas`
// (éphémère, non persisté). Label repliable : caché au repos (anti-collision
// §3.x), déplié au survol/sélection. Le modèle `pin.glb` (lot Asset MYL-20) est
// directionnel (pointe à l'origine, corps le long de +Y) : on le pose la pointe
// sur la surface, dressé le long de la normale sortante ; la teinte d'état et
// l'accent de zone restent pilotés par le code (matériau neutre dans le .glb).

/** Accent de zone du pin allumé (§7). Éteint = gris ardoise. */
const ZONE_ACCENT: Record<StudioDef["zone"], string> = {
  europe: "#5eead4",
  ameriques: "#fbbf24",
  asie: "#f472b6",
};

const PIN_URL = "/assets/worldmap/pin.glb";
const UP = new Vector3(0, 1, 0);

export interface StudioPinProps {
  def: StudioDef;
  selected: boolean;
  hovered: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function StudioPin({
  def,
  selected,
  hovered,
  onSelect,
  onHover,
}: StudioPinProps) {
  const status = useAppSelector((s) => selectStudioStatus(s, def.id));
  const lit = status === "unlocked";
  const accent = lit ? ZONE_ACCENT[def.zone] : "#475569";

  // Pointe posée pile sur la surface (le pin part de là vers l'extérieur, pas
  // besoin de décalage radial : sa pointe est à l'origine de son repère local).
  const position = useMemo<[number, number, number]>(
    () => latLonToVec3(def.coords.lat, def.coords.lon, GLOBE_RADIUS),
    [def.coords.lat, def.coords.lon],
  );

  // Oriente le +Y local du pin vers la normale sortante (radiale) au point.
  const quaternion = useMemo(() => {
    const normal = new Vector3(...position).normalize();
    return new Quaternion().setFromUnitVectors(UP, normal);
  }, [position]);

  // Clone par instance (la scène `useGLTF` est mise en cache et partagée), puis
  // teinte d'état + accent de zone pilotés par le code sur le matériau cloné.
  const { scene } = useGLTF(PIN_URL);
  const pin = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const mat = (mesh.material as MeshStandardMaterial).clone();
      mat.color.set(accent);
      mat.emissive.set(lit ? accent : "#1e293b");
      mat.emissiveIntensity = lit ? 1 : 0.25;
      mesh.material = mat;
    });
    return clone;
  }, [scene, accent, lit]);

  const showLabel = hovered || selected;
  const scale = selected ? 1.5 : hovered ? 1.25 : 1;

  return (
    <group
      position={position}
      quaternion={quaternion}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(def.id);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHover(null);
        document.body.style.cursor = "auto";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(def.id);
      }}
    >
      <primitive object={pin} scale={scale} />

      {showLabel && (
        <Html
          center
          distanceFactor={8}
          position={[0, 0.28, 0]}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <span className="whitespace-nowrap rounded bg-base-100/90 px-2 py-0.5 text-xs font-medium text-base-content shadow">
            {def.name}
          </span>
        </Html>
      )}
    </group>
  );
}

useGLTF.preload(PIN_URL);
