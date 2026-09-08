# Assets 3D MapMonde — globe + pins (MYL-20, Stage 2 / Asset Creator)

Deux `.glb` **auto-suffisants** (géométrie + texture embarquées, aucun fichier
annexe à charger) consommables directement par `useGLTF` de `@react-three/fiber`.
Validés **0 erreur / 0 warning** par le validateur Khronos glTF 2.0.

Régénérables via `node scripts/assets/generate-worldmap-assets.mjs`.

| Fichier | Contenu | Rayon / taille |
|---|---|---|
| `globe.glb` | Sphère Terre texturée (équirectangulaire) | rayon **1.5** = `GLOBE_RADIUS` |
| `pin.glb` | Marqueur « épingle » : tête sphérique + cône effilé | hauteur ≈ **0.19**, pointe à l'origine |

---

## 1. Globe — `globe.glb`

Bâti **exactement** sur la convention du Stage 1 : la sphère utilise la
paramétrisation `THREE.SphereGeometry` par défaut (`phiStart=0`), qui coïncide
avec `latLonToVec3(lat, lon, GLOBE_RADIUS)`. Les UV sont calés sur la même
convention (ligne 0 de la texture = +90° N, bord gauche = −180°), donc **les pins
posés via `latLonToVec3` tombent pile sur la bonne ville** (Paris, Helsinki,
Berlin, Montréal, LA, Tokyo).

Le rayon est déjà **1.5** : c'est un **drop-in** de la sphère placeholder de
`GlobeCanvas.tsx`, sans rescale.

```tsx
import { useGLTF } from "@react-three/drei";
import { GLOBE_RADIUS } from "@/components/worldmap/globeConfig"; // 1.5

function Globe() {
  const { scene } = useGLTF("/assets/worldmap/globe.glb");
  return <primitive object={scene} />; // déjà au rayon GLOBE_RADIUS
}
useGLTF.preload("/assets/worldmap/globe.glb");
```

> Remplace le bloc `{/* Sphère PLACEHOLDER ... */}` (les `<mesh><sphereGeometry .../></mesh>`)
> de `GlobeCanvas.tsx`. Aucun changement de caméra/lumières nécessaire.

---

## 2. Pin — `pin.glb`

**Modèle directionnel**, convention locale :
- **pointe à l'origine** `(0, 0, 0)`,
- corps qui monte le long de **+Y**, tête vers `y ≈ +0.19`.

À l'inverse de la sphère placeholder (sans orientation), un pin se pose la pointe
sur la surface, dressé le long de la **normale sortante** (radiale). Dans
`StudioPin.tsx`, oriente +Y local vers la normale au point du studio :

```tsx
import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";
import { useGLTF } from "@react-three/drei";

const UP = new Vector3(0, 1, 0);

// `position` = latLonToVec3(lat, lon, GLOBE_RADIUS)  (pointe sur la surface ;
// pas besoin de PIN_SURFACE_OFFSET, le pin part de la surface vers l'extérieur)
const quaternion = useMemo(() => {
  const normal = new Vector3(...position).normalize();
  return new Quaternion().setFromUnitVectors(UP, normal);
}, [position]);

const { scene } = useGLTF("/assets/worldmap/pin.glb");
const pin = useMemo(() => scene.clone(true), [scene]); // clone par instance

return <primitive object={pin} position={position} quaternion={quaternion} scale={scale} />;
```

### États visuels éteint / allumé (§7)

Le matériau du `.glb` est **neutre** (`pin_neutral`, blanc cassé légèrement
émissif) : la teinte d'état et l'**accent de zone** restent **pilotés par le
code**, exactement comme le placeholder actuel — il suffit de surcharger le
matériau du clone après chargement :

```tsx
// ZONE_ACCENT déjà défini dans StudioPin.tsx
const accent = lit ? ZONE_ACCENT[def.zone] : "#475569";
pin.traverse((o) => {
  if (o.isMesh) {
    o.material = o.material.clone();          // ne pas muter le matériau partagé
    o.material.color.set(accent);
    o.material.emissive.set(lit ? accent : "#1e293b");
    o.material.emissiveIntensity = lit ? 1 : 0.25;
  }
});
```

- **éteint** = studio verrouillé / ouvrable non ouvert → gris ardoise, émissif faible.
- **allumé** = studio ouvert → accent de zone (europe `#5eead4`, amériques `#fbbf24`,
  asie `#f472b6`), émissif plein.

> Densité visée 3/2/1 (Europe / Amériques / Asie) : déjà portée par les 6
> `STUDIO_DEFS` (`studios.ts`), rien à faire côté asset.

---

## Licence

Globe dérivé de la texture **NASA Blue Marble** (domaine public) via three.js
(MIT). Détails : `scripts/assets/textures/CREDITS.md`.
