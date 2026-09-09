// ── MapMonde — Données studios (MYL-18, Stage 1) ─────────────────────────────
// Contrats partagés des 6 studios du sélecteur MapMonde (issue parente MYL-10).
// Source verrouillée des chiffres : `docs/gdd/economy-worldmap-unlock.md`
// (seuils de réputation + coûts d'ouverture). Source des noms / zones / coords /
// accroches / bandeaux : `docs/gdd/lore-worldmap-studios.md` (§2, §3, §4) et
// `docs/gdd/ux-worldmap-mapmonde.md` (§4.1 accroches, §7 révélation).
//
// Ce module est PUR (aucune dépendance React/Three/Redux) pour rester testable
// et consommable par les lots Stage 2 (Asset / UI / Audio).

export type StudioZone = "europe" | "ameriques" | "asie";

export interface StudioDef {
  /** Clé stable du studio (jamais traduite, sert d'id de state). */
  id: string;
  /** Nom propre Lore (jamais « Studio AAA » — cf. Lore §0). */
  name: string;
  zone: StudioZone;
  /** Lat/lon réelles approx. de la ville d'ancrage (Lore §2, UX §3.x). */
  coords: { lat: number; lon: number };
  /** Comparé à `engine.peakReputation` (le pic) → déblocage irréversible. */
  reputationThreshold: number;
  /** Coût d'ouverture one-shot, débité sur `company.money` (€). */
  openingCost: number;
  /** Accroche carte-postale §4.1, 3ᵉ pers., ≤ ~70 car. (Lore §3). */
  tagline: string;
  /** Bandeau de micro-révélation §7. `undefined` pour le Garage (starter). */
  revealText?: string;
}

// Ordre Lore : Europe → Amériques → Asie, du plus accessible au plus prestigieux.
// Seuils/coûts = barème éco (economy-worldmap-unlock.md §2).
export const STUDIO_DEFS: StudioDef[] = [
  {
    id: "garage",
    name: "Le Garage",
    zone: "europe",
    coords: { lat: 48.85, lon: 2.35 }, // banlieue parisienne (FR)
    reputationThreshold: 0,
    openingCost: 0,
    tagline: "Là où tout commence. Petit, mais c'est ici que naissent les grands.",
    // Pas de révélation : débloqué d'entrée (Lore §4, UX §7).
  },
  {
    id: "atelier-nord",
    name: "L'Atelier Nord",
    zone: "europe",
    coords: { lat: 60.17, lon: 24.94 }, // Helsinki (Nordiques)
    reputationThreshold: 20,
    openingCost: 75000,
    tagline: "Au bord de l'eau, on fait des jeux qui ont une âme.",
    revealText:
      "L'Atelier Nord ouvre ses portes. Dehors il neige ; dedans, on rêve en grand.",
  },
  {
    id: "fonderie",
    name: "La Fonderie",
    zone: "europe",
    coords: { lat: 52.52, lon: 13.4 }, // Berlin (DE)
    reputationThreshold: 40,
    openingCost: 150000,
    tagline: "Briques, moteurs et serveurs : ici on construit du solide.",
    revealText: "La Fonderie rallume ses fours. À toi de faire tourner la machine.",
  },
  {
    id: "bastion",
    name: "Le Bastion",
    zone: "ameriques",
    coords: { lat: 45.5, lon: -73.57 }, // Montréal (CA-QC)
    reputationThreshold: 60,
    openingCost: 300000,
    tagline: "L'usine à grands jeux. On structure, on tient les délais.",
    revealText:
      "Le Bastion t'attendait. Ici, les jeux se comptent en équipes entières.",
  },
  {
    id: "cap-mirage",
    name: "Cap Mirage",
    zone: "ameriques",
    coords: { lat: 34.05, lon: -118.24 }, // Los Angeles (US-CA)
    reputationThreshold: 80,
    openingCost: 600000,
    tagline: "Soleil, trailers et grand frisson : le temple du AAA.",
    revealText:
      "Bienvenue à Cap Mirage. Les projecteurs sont braqués — ne les déçois pas.",
  },
  {
    id: "neon-ku",
    name: "Néon-Ku",
    zone: "asie",
    coords: { lat: 35.68, lon: 139.69 }, // Tokyo (JP)
    reputationThreshold: 95,
    openingCost: 1200000,
    tagline: "Néons et arcades. Le culte du détail, finition au pixel.",
    revealText: "Néon-Ku s'illumine. Ici, le moindre pixel se mérite.",
  },
];

/** Studio débloqué d'entrée (state seedé là-dessus). */
export const STARTER_STUDIO_ID = "garage";

/** Accès O(1) par id (table figée). */
export const STUDIO_BY_ID: Record<string, StudioDef> = STUDIO_DEFS.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<string, StudioDef>,
);

export const getStudioDef = (id: string): StudioDef | undefined =>
  STUDIO_BY_ID[id];

// ── Jauge §4.2 — progression du pic de réputation vers le seuil ──────────────
// Mesure UNIQUEMENT la réputation (le cash est une ligne binaire à part, jamais
// une 2ᵉ jauge — cf. UX §4.2 / éco §3). Bornée à [0,1], pleine dès le seuil.
export const studioUnlockProgress = (
  peakReputation: number,
  threshold: number,
): number =>
  threshold <= 0 ? 1 : Math.min(1, Math.max(0, peakReputation / threshold));

// ── Validation pure du déblocage (testée isolément) ──────────────────────────
export type StudioUnlockBlocker = "alreadyUnlocked" | "reputation" | "money";

export interface StudioUnlockCheck {
  ok: boolean;
  /** Premier verrou rencontré quand `ok === false`. */
  blocker?: StudioUnlockBlocker;
}

/**
 * Décide si `def` est ouvrable maintenant : pic de réputation ≥ seuil ET
 * trésorerie ≥ coût. `alreadyUnlocked` est traité comme un échec idempotent
 * (le thunk ne redébite jamais). On gate sur le PIC (`peakReputation`), pas la
 * réputation courante → irréversibilité (un creux ne re-verrouille pas).
 */
export const checkStudioUnlock = (
  def: StudioDef,
  peakReputation: number,
  money: number,
  alreadyUnlocked: boolean,
): StudioUnlockCheck => {
  if (alreadyUnlocked) return { ok: false, blocker: "alreadyUnlocked" };
  if (peakReputation < def.reputationThreshold)
    return { ok: false, blocker: "reputation" };
  if (money < def.openingCost) return { ok: false, blocker: "money" };
  return { ok: true };
};

// ── Convention de coordonnées du globe (contrat Asset Creator) ───────────────
/** Vecteur cartésien (tuple pur, pas de dépendance Three). */
export type Vec3 = [number, number, number];

/**
 * Convertit une position lat/lon (degrés) en point cartésien sur une sphère de
 * rayon `radius`, centrée à l'origine. Convention figée (à respecter par les pins
 * et la caméra) :
 *   - latitude  : −90 (pôle Sud) … +90 (pôle Nord)
 *   - longitude : −180 … +180, 0° = méridien de Greenwich
 *   - axe Y = axe des pôles (Nord vers +Y) ; (lat 0, lon 0) tombe sur +X.
 * Mapping standard sphère-texture (équirectangulaire, convention three.js) :
 *   phi   = (90 − lat)·π/180   (angle polaire depuis +Y)
 *   theta = (lon + 180)·π/180
 */
export const latLonToVec3 = (
  lat: number,
  lon: number,
  radius: number,
): Vec3 => {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return [x, y, z];
};

// ── Contrats de props des panneaux (pour l'Art Director, Stage 2) ────────────
// Interfaces TS documentées : l'UI peut s'habiller sur stubs sans attendre le
// câblage state. Statut dérivé des sélecteurs `selectStudioStatus` / progress.

export type StudioStatus = "unlocked" | "unlockable" | "locked";

/** Panneau d'aperçu « carte-postale » §4.1 (studio débloqué). */
export interface StudioPreviewPanelProps {
  def: StudioDef;
  /** Réputation courante du studio-lieu (couche 2, libellé éco à venir). */
  reputation?: number;
}

/** Pop-in « Studio verrouillé » §4.2 (jauge réputation + ligne coût + bouton 3 états). */
export interface StudioLockedPopinProps {
  def: StudioDef;
  /** Pic de réputation (`engine.peakReputation`) — alimente la jauge. */
  peakReputation: number;
  /** Trésorerie courante (`company.money`) — état binaire du coût. */
  money: number;
  /** `unlockable` quand peak ≥ seuil mais pas encore ouvert ; sinon `locked`. */
  status: Extract<StudioStatus, "unlockable" | "locked">;
  /** Déclenche le thunk `unlockStudio(def.id)` (actif au seul état ouvrable). */
  onUnlock: () => void;
}

/** Bandeau de micro-révélation §7 (1 ligne, voix mentor, variante Reduce Motion). */
export interface RevealBannerProps {
  /** Texte §7 du studio qui vient d'ouvrir (`def.revealText`). */
  text: string;
  /** Honoré par l'appelant : pas de glissé caméra ni de slide si vrai. */
  reduceMotion?: boolean;
  /** Appelé en fin de séquence pour ranger le bandeau (clearStudioReveal). */
  onDismiss: () => void;
}
