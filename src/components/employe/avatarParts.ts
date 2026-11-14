import {
  AvatarEyes,
  AvatarFace,
  AvatarHair,
  AvatarMouth,
} from "@/data/interface";

// ─────────────────────────────────────────────────────────────────────────────
// Tracés de l'avatar, dans un repère 100 × 100 centré sur le visage (50, 50).
// Chaque partie tient dans quelques `d` : `fill` pour les formes pleines
// d'encre, `white` pour le blanc des yeux, `line` pour les traits seuls.
// ─────────────────────────────────────────────────────────────────────────────

/** Cercle en tracé (deux arcs). */
const circle = (x: number, y: number, r: number): string =>
  `M${x - r} ${y} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z `;

/** Ellipse en tracé. */
const ellipse = (x: number, y: number, rx: number, ry: number): string =>
  `M${x - rx} ${y} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z `;

export const NECK = "M43 64 L43 86 L57 86 L57 64 Z";
export const SHOULDERS = "M12 106 C12 90 30 83 50 83 C70 83 88 90 88 106 Z";
export const CHEEKS = circle(35, 58, 3.6) + circle(65, 58, 3.6);

/** Visage, et abscisses des oreilles qui vont avec. */
export const FACE_PARTS: Record<AvatarFace, { d: string; ears: string }> = {
  rond: { d: circle(50, 50, 22), ears: circle(28, 53, 5) + circle(72, 53, 5) },
  ovale: {
    d: ellipse(50, 51, 20, 25),
    ears: circle(30, 53, 5) + circle(70, 53, 5),
  },
  carre: {
    d: "M37 28 H63 Q72 28 72 37 V65 Q72 74 63 74 H37 Q28 74 28 65 V37 Q28 28 37 28 Z",
    ears: circle(28, 53, 5) + circle(72, 53, 5),
  },
  pointu: {
    d: "M50 77 C44 77 29 62 28 47 C27 35 37 27 50 27 C63 27 73 35 72 47 C71 62 56 77 50 77 Z",
    ears: circle(28, 53, 5) + circle(72, 53, 5),
  },
  large: {
    d: ellipse(50, 52, 25, 21),
    ears: circle(25, 53, 5) + circle(75, 53, 5),
  },
};

interface FeatureParts {
  fill?: string;
  white?: string;
  line?: string;
}

export const EYE_PARTS: Record<AvatarEyes, FeatureParts> = {
  points: { fill: circle(41, 49, 3) + circle(59, 49, 3) },
  ronds: {
    white: circle(41, 49, 5.5) + circle(59, 49, 5.5),
    fill: circle(42, 50, 2.6) + circle(60, 50, 2.6),
  },
  joyeux: { line: "M37 51 Q41 45.5 45 51 M55 51 Q59 45.5 63 51" },
  endormis: {
    fill: "M37 48 a4 4 0 0 0 8 0 Z M55 48 a4 4 0 0 0 8 0 Z",
    line: "M36 48 H46 M54 48 H64",
  },
  cils: {
    fill: circle(41, 49, 3) + circle(59, 49, 3),
    line: "M38 46.5 L35.5 44.5 M40.5 45.5 L40 43 M62 46.5 L64.5 44.5 M59.5 45.5 L60 43",
  },
  lunettes: {
    fill: circle(41, 49, 2.6) + circle(59, 49, 2.6),
    line: circle(41, 49, 7) + circle(59, 49, 7) + "M48 49 H52",
  },
};

export const MOUTH_PARTS: Record<AvatarMouth, FeatureParts> = {
  sourire: { line: "M43 61 Q50 67.5 57 61" },
  rire: { fill: "M42 60 Q50 73 58 60 Z" },
  neutre: { line: "M44 63 H56" },
  oh: { fill: circle(50, 63, 3.2) },
  coin: { line: "M44 63 Q51 65.5 57 59.5" },
};

/** Cheveux : `back` passe derrière la tête, `front` par-dessus le visage. */
export const HAIR_PARTS: Record<AvatarHair, { back?: string; front?: string }> =
  {
    chauve: {},
    court: {
      front:
        "M27 47 C26 32 37 23 50 23 C63 23 74 32 73 47 C68 39 60 35 50 35 C40 35 32 39 27 47 Z",
    },
    meche: {
      front:
        "M27 48 C25 31 37 22 51 22 C64 22 75 31 73 46 C69 40 64 36 58 35 C52 41 40 44 30 44 C29 45 28 46 27 48 Z",
    },
    herisse: {
      front:
        "M27 46 L25 30 L33 34 L35 21 L43 29 L50 18 L56 29 L65 21 L67 34 L75 30 L73 46 C67 38 59 35 50 35 C41 35 33 38 27 46 Z",
    },
    bol: {
      front:
        "M25 52 C23 32 35 22 50 22 C65 22 77 32 75 52 L70 52 C70 45 69 42 67 41 L33 41 C31 42 30 45 30 52 Z",
    },
    chignon: {
      back: circle(50, 19, 8.5),
      front:
        "M27 46 C27 32 37 25 50 25 C63 25 73 32 73 46 C67 38 60 34 50 34 C40 34 33 38 27 46 Z",
    },
    long: {
      back: "M24 50 C22 30 35 21 50 21 C65 21 78 30 76 50 L78 84 C70 88 62 86 60 82 L40 82 C38 86 30 88 22 84 Z",
      front:
        "M27 50 C26 32 37 23 50 23 C63 23 74 32 73 50 C71 40 62 33 50 31 C38 33 29 40 27 50 Z",
    },
    afro: {
      back: circle(50, 43, 31),
      front:
        "M28 44 C30 32 40 27 50 27 C60 27 70 32 72 44 C66 38 58 36 50 36 C42 36 34 38 28 44 Z",
    },
  };

/**
 * Épaisseur du contour d'encre, en unités du repère, pour un rendu à `size`
 * pixels : fin en liste, franc en grand.
 */
export const strokeFor = (size: number): number => {
  const px = size >= 120 ? 3.5 : size >= 60 ? 2.5 : size >= 40 ? 2.1 : 1.7;
  return (px * 100) / size;
};
