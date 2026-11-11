import {
  COMPONENT_TYPE_ORDER,
  ComponentRequirement,
  ComponentType,
  GENRES,
  Product,
  ProductFeature,
  ProductGenre,
  productSize,
} from "@/data/interface";
import { isFeatureUnlocked } from "@/data/utils/technology";

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue des fonctionnalités.
//
// Un produit est un assemblage : le socle de son genre, obligatoire, plus ce
// qu'on choisit d'y ajouter parmi les fonctionnalités qui ont leur place sur
// ce segment. Chaque fonctionnalité coûte des composants — la somme fait les
// besoins de développement — et rapporte une attractivité égale à ce coût,
// pondérée par son poids sur le segment. Le catalogue s'adapte donc au genre :
// un jeu propose un mode histoire, un service des abonnements, une plateforme
// un SDK ; quelques briques génériques (interface, mobile, traductions…) sont
// partagées, avec un poids différent selon le segment.
// ─────────────────────────────────────────────────────────────────────────────

const cost = (
  code: number,
  visuel: number,
  ux: number,
): Record<ComponentType, number> => ({
  [ComponentType.CODE]: code,
  [ComponentType.VISUEL]: visuel,
  [ComponentType.UX]: ux,
});

const { OUTIL, SERVICE, JEU, PLATEFORME } = ProductGenre;

/** Socles : leur coût est la taille minimale du genre (`GENRES[g].minSize`). */
export const FEATURES: ProductFeature[] = [
  // ── Socles ────────────────────────────────────────────────────────────────
  {
    id: "core_tool",
    label: "Cœur applicatif",
    description: "Ce que fait l'outil. Socle d'un Outil.",
    cost: cost(4, 1, 1),
    coreOf: OUTIL,
    genres: {},
  },
  {
    id: "core_service",
    label: "Back-office",
    description: "Comptes, données, facturation. Socle d'un Service.",
    cost: cost(5, 1, 4),
    coreOf: SERVICE,
    genres: {},
  },
  {
    id: "core_game",
    label: "Moteur de jeu",
    description: "Boucle de jeu, rendu, contrôles. Socle d'un Jeu.",
    cost: cost(6, 5, 1),
    coreOf: JEU,
    genres: {},
  },
  {
    id: "core_platform",
    label: "API publique",
    description: "Ce sur quoi les autres construisent. Socle d'une Plateforme.",
    cost: cost(14, 3, 8),
    coreOf: PLATEFORME,
    genres: {},
  },

  // ── Génériques : plusieurs segments, poids variable ───────────────────────
  {
    id: "ui_polish",
    label: "Interface soignée",
    description: "On la remarque tout de suite.",
    cost: cost(1, 4, 3),
    genres: { [OUTIL]: 1, [SERVICE]: 1.2, [JEU]: 1.2, [PLATEFORME]: 0.8 },
  },
  {
    id: "onboarding",
    label: "Prise en main guidée",
    description: "Personne ne décroche les premières minutes.",
    cost: cost(1, 2, 5),
    genres: { [OUTIL]: 1.2, [SERVICE]: 1.3, [JEU]: 0.8 },
  },
  {
    id: "mobile",
    label: "Version mobile",
    description: "Dans la poche de tout le monde.",
    cost: cost(4, 3, 3),
    genres: { [OUTIL]: 0.9, [SERVICE]: 1.2, [JEU]: 1.2 },
  },
  {
    id: "localization",
    label: "Traductions",
    description: "Le monde entier, pas seulement le pays.",
    cost: cost(1, 2, 3),
    genres: { [OUTIL]: 1.1, [SERVICE]: 1.1, [JEU]: 1.1, [PLATEFORME]: 1.2 },
  },
  {
    id: "cloud_sync",
    label: "Synchronisation cloud",
    description: "Les données suivent l'utilisateur partout.",
    cost: cost(5, 0, 2),
    genres: { [OUTIL]: 1.2, [SERVICE]: 1.3, [PLATEFORME]: 1.2 },
  },
  {
    id: "analytics",
    label: "Tableaux de bord",
    description: "Des chiffres qui se lisent d'un coup d'œil.",
    cost: cost(3, 3, 3),
    genres: { [OUTIL]: 1, [SERVICE]: 1.2, [PLATEFORME]: 1.3 },
  },
  {
    id: "security",
    label: "Sécurité renforcée",
    description: "Ce qui rassure les gros clients.",
    cost: cost(5, 0, 1),
    genres: { [OUTIL]: 0.9, [SERVICE]: 1.3, [PLATEFORME]: 1.4 },
  },

  // ── Outil ─────────────────────────────────────────────────────────────────
  {
    id: "automation",
    label: "Automatisations",
    description: "Le travail répétitif disparaît.",
    cost: cost(5, 1, 2),
    genres: { [OUTIL]: 1.4, [SERVICE]: 1.1, [PLATEFORME]: 1.1 },
  },
  {
    id: "import_export",
    label: "Import / export",
    description: "Parle avec les fichiers et les outils qu'on a déjà.",
    cost: cost(3, 0, 2),
    genres: { [OUTIL]: 1.3, [SERVICE]: 1 },
  },
  {
    id: "offline",
    label: "Mode hors-ligne",
    description: "Fonctionne sans réseau, synchronise après.",
    cost: cost(4, 0, 1),
    genres: { [OUTIL]: 1.2 },
  },
  {
    id: "plugins",
    label: "Extensions tierces",
    description: "Laisser les autres l'étendre.",
    cost: cost(6, 1, 3),
    genres: { [OUTIL]: 1.2, [PLATEFORME]: 1.5 },
  },

  // ── Service ───────────────────────────────────────────────────────────────
  {
    id: "subscriptions",
    label: "Abonnements",
    description: "Des formules, des paliers, du revenu qui revient.",
    cost: cost(3, 1, 3),
    genres: { [SERVICE]: 1.4 },
  },
  {
    id: "payments",
    label: "Paiement intégré",
    description: "Encaisser sans quitter le produit.",
    cost: cost(4, 1, 2),
    genres: { [SERVICE]: 1.4, [PLATEFORME]: 1.3 },
  },
  {
    id: "support",
    label: "Support client",
    description: "Quelqu'un répond, et vite.",
    cost: cost(2, 1, 5),
    genres: { [SERVICE]: 1.3, [PLATEFORME]: 1.1 },
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Le produit revient vers l'utilisateur.",
    cost: cost(3, 1, 2),
    genres: { [SERVICE]: 1.2, [JEU]: 1 },
  },

  // ── Jeu ───────────────────────────────────────────────────────────────────
  {
    id: "multiplayer",
    label: "Multijoueur",
    description: "À plusieurs, ça change tout.",
    cost: cost(6, 2, 2),
    genres: { [JEU]: 1.5 },
  },
  {
    id: "story_mode",
    label: "Mode histoire",
    description: "Une raison de continuer jusqu'au bout.",
    cost: cost(3, 5, 3),
    genres: { [JEU]: 1.4 },
  },
  {
    id: "content_pack",
    label: "Contenu additionnel",
    description: "Plus à voir, plus à faire.",
    cost: cost(2, 6, 1),
    genres: { [JEU]: 1.5 },
  },
  {
    id: "soundtrack",
    label: "Bande-son originale",
    description: "Ce qu'on fredonne après avoir éteint.",
    cost: cost(0, 6, 1),
    genres: { [JEU]: 1.3 },
  },
  {
    id: "achievements",
    label: "Succès et classements",
    description: "Se comparer, recommencer.",
    cost: cost(3, 2, 2),
    genres: { [JEU]: 1.2 },
  },

  // ── Plateforme ────────────────────────────────────────────────────────────
  {
    id: "sdk",
    label: "SDK développeurs",
    description: "Construire dessus en un après-midi.",
    cost: cost(8, 1, 4),
    genres: { [PLATEFORME]: 1.5 },
  },
  {
    id: "marketplace",
    label: "Place de marché",
    description: "Les autres vendent chez vous.",
    cost: cost(6, 4, 4),
    genres: { [PLATEFORME]: 1.4 },
  },
  {
    id: "sla",
    label: "Garantie de service",
    description:
      "Disponibilité contractuelle : ce que signent les grands comptes.",
    cost: cost(6, 0, 2),
    genres: { [PLATEFORME]: 1.3 },
  },
];

export const FEATURE_BY_ID: Record<string, ProductFeature> = Object.fromEntries(
  FEATURES.map((f) => [f.id, f]),
);

/** Socle d'un genre : la fonctionnalité obligatoire de tout produit du genre. */
export const coreFeature = (genre: ProductGenre): ProductFeature => {
  const core = FEATURES.find((f) => f.coreOf === genre);
  if (!core) throw new Error(`Aucun socle pour le genre ${genre}`);
  return core;
};

/** Une fonctionnalité a-t-elle sa place sur ce segment (socle compris) ? */
export const featureFits = (f: ProductFeature, genre: ProductGenre): boolean =>
  f.coreOf === genre || f.genres[genre] !== undefined;

/** Fonctionnalités proposées à un genre, hors socle. */
export const optionalFeatures = (genre: ProductGenre): ProductFeature[] =>
  FEATURES.filter((f) => f.coreOf === undefined && featureFits(f, genre));

/** Coût total d'une fonctionnalité, en composants. */
export const featureCost = (f: ProductFeature): number =>
  COMPONENT_TYPE_ORDER.reduce((acc, t) => acc + (f.cost[t] ?? 0), 0);

/**
 * Poids d'une fonctionnalité sur un genre. Neutre (1) pour un socle et pour
 * une fonctionnalité qui n'y est pas proposée — un produit d'avant le
 * catalogue par genre garde ce qu'il a payé.
 */
export const featureAffinity = (
  f: ProductFeature,
  genre: ProductGenre,
): number => f.genres[genre] ?? 1;

/** Attractivité apportée par une fonctionnalité sur un genre. */
export const featureAppeal = (f: ProductFeature, genre: ProductGenre): number =>
  featureCost(f) * featureAffinity(f, genre);

/** « ×1,5 » / « ×0,8 » : le poids affiché, vide quand il vaut 1. */
export const affinityLabel = (
  f: ProductFeature,
  genre: ProductGenre,
): string => {
  const a = featureAffinity(f, genre);
  return a === 1 ? "" : `×${a.toFixed(1).replace(".", ",")}`;
};

/** Composants requis par un ensemble de fonctionnalités. */
export const featuresRequirements = (
  ids: string[],
): Record<ComponentType, number> => {
  const total = cost(0, 0, 0);
  for (const id of ids) {
    const f = FEATURE_BY_ID[id];
    if (!f) continue;
    for (const t of COMPONENT_TYPE_ORDER) total[t] += f.cost[t] ?? 0;
  }
  return total;
};

/** Le coût d'une fonctionnalité sous forme de besoins (types à quantité > 0). */
export const featureRequirements = (
  f: ProductFeature,
): ComponentRequirement[] =>
  COMPONENT_TYPE_ORDER.filter((t) => (f.cost[t] ?? 0) > 0).map((t) => ({
    type: t,
    quantity: f.cost[t],
  }));

/** Fonctionnalités d'un produit, dans l'ordre du catalogue. */
export const productFeatures = (p: Product): ProductFeature[] =>
  FEATURES.filter((f) => (p.features ?? []).includes(f.id));

/**
 * Fonctionnalités proposées à un genre à cet instant : celles que les
 * technologies déjà apparues rendent possibles (cf. `utils/technology`).
 */
export const unlockedOptionalFeatures = (
  genre: ProductGenre,
  time: number,
): ProductFeature[] =>
  optionalFeatures(genre).filter((f) => isFeatureUnlocked(f.id, time));

/**
 * Fonctionnalités qu'un produit peut encore recevoir, sur son segment et à
 * cet instant. Sans heure : tout le catalogue du segment.
 */
export const availableFeatures = (
  p: Product,
  time: number = Number.POSITIVE_INFINITY,
): ProductFeature[] =>
  unlockedOptionalFeatures(p.genre, time).filter(
    (f) => !(p.features ?? []).includes(f.id),
  );

/** Toutes les fonctionnalités d'un assemblage existent-elles à cet instant ? */
export const isAssemblyUnlocked = (ids: string[], time: number): boolean =>
  ids.every((id) => isFeatureUnlocked(id, time));

/**
 * Attractivité de base d'un produit : somme des fonctionnalités pondérées
 * par leur poids sur son genre. Un produit d'avant le catalogue (sans
 * fonctionnalité) garde sa taille brute — rien ne lui est retiré.
 */
export const productBaseAppeal = (p: Product): number => {
  const features = productFeatures(p);
  if (features.length === 0) return productSize(p);
  return features.reduce((acc, f) => acc + featureAppeal(f, p.genre), 0);
};

/**
 * Vérifie qu'un assemblage tient : socle du genre présent, ids connus, sans
 * doublon, et chaque option proposée sur ce genre.
 */
export const isValidAssembly = (genre: ProductGenre, ids: string[]): boolean =>
  ids.includes(coreFeature(genre).id) &&
  new Set(ids).size === ids.length &&
  ids.every((id) => {
    const f = FEATURE_BY_ID[id];
    return f !== undefined && featureFits(f, genre);
  });

/** Garde-fou : la taille minimale d'un genre est le coût de son socle. */
export const coreCostMatchesGenre = (genre: ProductGenre): boolean =>
  featureCost(coreFeature(genre)) === GENRES[genre].minSize;
