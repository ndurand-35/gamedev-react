// ── Villes procédurales de SeLoger ───────────────────────────────────────────
// Chaque partie tire une graine (`company.citySeed`) ; chaque ville en dérive
// la sienne. Le plan (rues, rivière, ponts, parcs, quartiers, îlots) n'est
// jamais sauvegardé : il est recalculé, identique, à partir de la graine.
//
// Module PUR : aucun accès à Math.random, à Redux ni à React. Le hasard des
// annonces de la semaine vit ailleurs (`utils/studioListing`) ; ici tout est
// reproductible, pour qu'un bâtiment acheté retrouve toujours son îlot.

/** Repère du plan : le SVG de la carte utilise ce même repère. */
export const CITY_MAP_WIDTH = 1000;
export const CITY_MAP_HEIGHT = 620;

/** Demi-largeur de la rivière, contour compris. */
export const RIVER_HALF_WIDTH = 38;

/**
 * Réputation (pic atteint) qui ouvre chaque ville. La première est celle du
 * Garage ; les suivantes s'alignent sur les paliers de réputation (25/50/75).
 */
export const CITY_UNLOCK_REPUTATION = [0, 25, 50, 75] as const;

export const CITY_COUNT = CITY_UNLOCK_REPUTATION.length;

/** Îlot du plan. Les lots constructibles accueillent les studios. */
export interface CityBlock {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  /** Indice du quartier (cf. `CityPlan.districts`). */
  district: number;
  park: boolean;
  /** Au bord de l'eau. */
  riverside: boolean;
  /** Un parc à deux pas. */
  nearPark: boolean;
  /** Le long d'une des deux avenues. */
  onAvenue: boolean;
  /** Assez grand et assez loin des bords pour y poser un studio. */
  buildable: boolean;
}

export interface CityDistrict {
  name: string;
  /** Position de l'étiquette, dans le repère du plan. */
  x: number;
  y: number;
}

export interface CityBridge {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CityPlan {
  /** Rang de la ville dans la partie (0 = ville du Garage). */
  index: number;
  seed: number;
  name: string;
  country: string;
  blocks: CityBlock[];
  districts: CityDistrict[];
  /** Tracé SVG (Bézier cubique) du lit de la rivière. */
  river: string;
  bridges: CityBridge[];
  /** Lot du Garage de départ (ville 0 seulement, mais calculé partout). */
  starterLot: number;
}

// ── Hasard reproductible ─────────────────────────────────────────────────────

/** mulberry32 : générateur 32 bits rapide et reproductible. */
export const seededRandom = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Mélange deux entiers en une graine (pour dériver la graine d'une ville). */
const mixSeed = (a: number, b: number): number => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 1, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  return h >>> 0;
};

const shuffled = <T>(arr: readonly T[], rnd: () => number): T[] => {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/** Nouvelle graine de partie. Seul point d'entrée non déterministe du module. */
export const newCitySeed = (): number =>
  Math.floor(Math.random() * 0x7fffffff) + 1;

// ── Noms ─────────────────────────────────────────────────────────────────────

const CITY_NAMES: readonly (readonly [string, string])[] = [
  ["Montclair", "France"],
  ["Valbrume", "France"],
  ["Roche-Haute", "France"],
  ["Saint-Aubert", "France"],
  ["Belleroche", "Belgique"],
  ["Port-Varenne", "France"],
  ["Lagrange-sur-Ondine", "France"],
  ["Brévallon", "Suisse"],
  ["Mont-Lumière", "Canada"],
  ["Chantebrise", "France"],
  ["Ormesson-les-Bains", "Belgique"],
  ["Vieux-Moulin", "Suisse"],
];

const DISTRICT_NAMES = [
  "Les Tanneurs",
  "Bellevue",
  "Saint-Roch",
  "Les Forges",
  "Le Marché",
  "Les Lilas",
  "Le Port",
  "Sainte-Anne",
  "Les Arts",
  "Montgarde",
  "La Verrerie",
  "Les Remparts",
  "Le Campus",
  "La Gare",
  "Les Halles",
  "Le Vieux Bourg",
];

// ── Villes de la partie ──────────────────────────────────────────────────────

/** Nombre de villes ouvertes pour un pic de réputation donné. */
export const unlockedCityCount = (peakReputation: number): number =>
  CITY_UNLOCK_REPUTATION.filter((r) => peakReputation >= r).length;

const planCache = new Map<string, CityPlan>();

/** Plan de la ville `index` d'une partie. Mémoïsé : appelé à chaque rendu. */
export const getCityPlan = (gameSeed: number, index: number): CityPlan => {
  const key = `${gameSeed}:${index}`;
  let plan = planCache.get(key);
  if (!plan) {
    // Noms tirés sans remise pour la partie : deux villes ne s'appellent
    // jamais pareil.
    const names = shuffled(CITY_NAMES, seededRandom(mixSeed(gameSeed, 999)));
    const [name, country] = names[index % names.length];
    plan = generateCityPlan(mixSeed(gameSeed, index), index, name, country);
    planCache.set(key, plan);
  }
  return plan;
};

// ── Génération du plan ───────────────────────────────────────────────────────

const COLS = 9;
const ROWS = 6;
const STREET = 16;
const AVENUE = 30;

export const generateCityPlan = (
  seed: number,
  index: number,
  name: string,
  country: string,
): CityPlan => {
  const rnd = seededRandom(seed);
  const ri = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const W = CITY_MAP_WIDTH;
  const H = CITY_MAP_HEIGHT;

  // Grille irrégulière : colonnes et rangées décalées, une avenue par sens.
  const xs = [-40];
  for (let i = 1; i < COLS; i++) xs.push((i * W) / COLS + (rnd() - 0.5) * 50);
  xs.push(W + 40);
  const ys = [-40];
  for (let j = 1; j < ROWS; j++) ys.push((j * H) / ROWS + (rnd() - 0.5) * 44);
  ys.push(H + 40);
  const avX = ri(2, COLS - 2);
  const avY = ri(1, ROWS - 1);
  const gx = (k: number) => (k === avX ? AVENUE : STREET);
  const gy = (k: number) => (k === avY ? AVENUE : STREET);

  // Rivière : une Bézier qui traverse le plan de gauche à droite.
  const y0 = ri(130, 490);
  const y1 = ri(130, 490);
  const c1 = [ri(250, 400), ri(60, 560)];
  const c2 = [ri(600, 750), ri(60, 560)];
  const river = `M-60 ${y0}C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} 1060 ${y1}`;
  const pts: [number, number][] = [];
  for (let k = 0; k <= 90; k++) {
    const t = k / 90;
    const u = 1 - t;
    pts.push([
      u * u * u * -60 +
        3 * u * u * t * c1[0] +
        3 * u * t * t * c2[0] +
        t * t * t * 1060,
      u * u * u * y0 +
        3 * u * u * t * c1[1] +
        3 * u * t * t * c2[1] +
        t * t * t * y1,
    ]);
  }
  const distToRiver = (x: number, y: number) => {
    let m = Infinity;
    for (let q = 0; q < pts.length - 1; q++) {
      const [ax, ay] = pts[q];
      const dx = pts[q + 1][0] - ax;
      const dy = pts[q + 1][1] - ay;
      let t = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy);
      t = Math.max(0, Math.min(1, t));
      m = Math.min(m, Math.hypot(ax + t * dx - x, ay + t * dy - y));
    }
    return m;
  };
  const riverYAt = (x: number): number | null => {
    for (let q = 0; q < pts.length - 1; q++) {
      if ((pts[q][0] - x) * (pts[q + 1][0] - x) <= 0) {
        const f = (x - pts[q][0]) / (pts[q + 1][0] - pts[q][0] || 1);
        return pts[q][1] + f * (pts[q + 1][1] - pts[q][1]);
      }
    }
    return null;
  };

  // Îlots, parfois coupés par une ruelle ; ceux que la rivière touche
  // disparaissent (la berge reste une promenade).
  const raw: Omit<CityBlock, "id" | "district" | "nearPark" | "buildable">[] =
    [];
  for (let i = 0; i < COLS; i++) {
    for (let j = 0; j < ROWS; j++) {
      const x = xs[i] + gx(i) / 2 + rnd() * 5;
      const x2 = xs[i + 1] - gx(i + 1) / 2 - rnd() * 5;
      const y = ys[j] + gy(j) / 2 + rnd() * 5;
      const y2 = ys[j + 1] - gy(j + 1) / 2 - rnd() * 5;
      let parts: [number, number, number, number][] = [[x, y, x2, y2]];
      if (rnd() < 0.45) {
        if (x2 - x > y2 - y) {
          const m = x + (x2 - x) * (0.35 + rnd() * 0.3);
          parts = [
            [x, y, m - 5, y2],
            [m + 5, y, x2, y2],
          ];
        } else {
          const m = y + (y2 - y) * (0.35 + rnd() * 0.3);
          parts = [
            [x, y, x2, m - 5],
            [x, m + 5, x2, y2],
          ];
        }
      }
      for (const [a, b, c, d] of parts) {
        let near = Infinity;
        for (const px of [a, (a + c) / 2, c]) {
          for (const py of [b, (b + d) / 2, d]) {
            near = Math.min(near, distToRiver(px, py));
          }
        }
        if (near < RIVER_HALF_WIDTH + 12) continue;
        const cx = (a + c) / 2;
        const cy = (b + d) / 2;
        raw.push({
          x: a,
          y: b,
          w: c - a,
          h: d - b,
          cx,
          cy,
          park: false,
          riverside: near < RIVER_HALF_WIDTH + 70,
          onAvenue: Math.abs(cx - xs[avX]) < 80 || Math.abs(cy - ys[avY]) < 70,
        });
      }
    }
  }

  const isInner = (b: { cx: number; cy: number }) =>
    b.cx > 60 && b.cx < W - 60 && b.cy > 60 && b.cy < H - 40;
  const inner = raw.filter(isInner);
  for (const b of shuffled(inner, rnd).slice(0, ri(2, 3))) b.park = true;
  const parks = raw.filter((b) => b.park);

  // Quartiers : 5 germes bien répartis, chaque îlot rejoint le plus proche.
  const names = shuffled(DISTRICT_NAMES, rnd);
  const seeds = [inner[Math.floor(rnd() * inner.length)]];
  while (seeds.length < 5) {
    let best = inner[0];
    let bestD = -1;
    for (const b of shuffled(inner, rnd).slice(0, 14)) {
      const d = Math.min(
        ...seeds.map((s) => Math.hypot(s.cx - b.cx, (s.cy - b.cy) * 1.6)),
      );
      if (d > bestD) {
        bestD = d;
        best = b;
      }
    }
    seeds.push(best);
  }
  const acc = seeds.map(() => ({ x: 0, y: 0, n: 0 }));
  const blocks: CityBlock[] = raw.map((b, id) => {
    let district = 0;
    let bd = Infinity;
    seeds.forEach((s, si) => {
      const d = Math.hypot(s.cx - b.cx, s.cy - b.cy);
      if (d < bd) {
        bd = d;
        district = si;
      }
    });
    if (b.cx > 0 && b.cx < W && b.cy > 0 && b.cy < H) {
      acc[district].x += b.cx;
      acc[district].y += b.cy;
      acc[district].n++;
    }
    const nearPark =
      !b.park && parks.some((p) => Math.hypot(p.cx - b.cx, p.cy - b.cy) < 170);
    return {
      ...b,
      id,
      district,
      nearPark,
      buildable: !b.park && isInner(b) && b.w > 34 && b.h > 34,
    };
  });
  const districts: CityDistrict[] = acc.map((c, di) => ({
    name: names[di],
    x: Math.max(90, Math.min(W - 90, c.n ? c.x / c.n : seeds[di].cx)),
    y: Math.max(30, Math.min(H - 30, c.n ? c.y / c.n : seeds[di].cy)),
  }));

  // Ponts : l'avenue et deux autres rues franchissent la rivière.
  const others = shuffled(
    [...Array(COLS - 1).keys()].map((k) => k + 1).filter((k) => k !== avX),
    rnd,
  );
  const bridges: CityBridge[] = [];
  for (const k of [avX, ...others.slice(0, 2)]) {
    const y = riverYAt(xs[k]);
    if (y == null || y < -40 || y > H + 40) continue;
    bridges.push({ x: xs[k] - gx(k) / 2 - 3, y: y - 58, w: gx(k) + 6, h: 116 });
  }

  const buildable = blocks.filter((b) => b.buildable);
  const starter =
    shuffled(
      buildable.filter((b) => !b.riverside),
      rnd,
    )[0] ?? buildable[0];

  return {
    index,
    seed,
    name,
    country,
    blocks,
    districts,
    river,
    bridges,
    starterLot: starter?.id ?? 0,
  };
};
