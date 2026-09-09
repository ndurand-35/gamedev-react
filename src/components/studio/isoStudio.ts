import {
  Employe,
  PersonType,
  ProductionPerson,
  ComponentType,
} from "@/data/interface";

// ─────────────────────────────────────────────────────────────────────────────
// Thème « studio » — dérivations du modèle vers l'habillage des cartes SVG.
//
// Ce module ne portait à l'origine que la scène isométrique (MYL-17). Celle-ci a
// été retirée au profit des vues cartes/liste/tableau de l'Accueil ; il ne reste
// ici que ce dont dépendent les cartes diégétiques (CandidateCard) : la couleur
// d'accent dérivée du rôle ou du composant, et la normalisation du modèle.
// ─────────────────────────────────────────────────────────────────────────────

/** Racine des assets servis depuis public/ (respecte le base Vite). */
export const STUDIO_ASSET_ROOT = `${import.meta.env.BASE_URL}assets/studio/`;

// ── Rôles studio (dérivés du modèle réel) ────────────────────────────────────
export type StudioRole = "dev" | "designer" | "qa" | "marketing";

/** Dérive le rôle studio depuis PersonType (+ la spécialité pour la prod). */
export const deriveRole = (emp: Employe): StudioRole => {
  switch (emp.personType) {
    case PersonType.QA:
      return "qa";
    case PersonType.MARKETING:
      return "marketing";
    case PersonType.PROD:
    default: {
      // Visuel et UX relèvent du design ; Code et polyvalent, du dev.
      const specialty = (emp as ProductionPerson).specialty;
      return specialty === ComponentType.VISUEL ||
        specialty === ComponentType.UX
        ? "designer"
        : "dev";
    }
  }
};

// ── Couleur = donnée ─────────────────────────────────────────────────────────
/** --accent ← assignedComponentType / specialty. */
export const ACCENT_BY_COMPONENT: Record<ComponentType, string> = {
  [ComponentType.CODE]: "#3B82F6",
  [ComponentType.VISUEL]: "#8B5CF6",
  [ComponentType.UX]: "#14B8A6",
};
export const ACCENT_DEFAULT = "#3B82F6";

/** Accent par défaut par rôle. */
export const ACCENT_BY_ROLE: Record<StudioRole, string> = {
  dev: "#3B82F6",
  designer: "#8B5CF6",
  qa: "#F59E0B",
  marketing: "#EC4899",
};

/** --morale-color ← palier de `morale` (5 paliers, seuils repris de employe.ts). */
export const moraleColor = (morale: number): string => {
  if (morale >= 85) return "#22C55E"; // excellent
  if (morale >= 70) return "#84CC16"; // bon (DEFAULT_MORALE)
  if (morale >= 50) return "#F59E0B"; // moyen
  if (morale >= 20) return "#EF4444"; // bas (LOW_MORALE_THRESHOLD)
  return "#B91C1C"; // critique (< RESIGNATION_MORALE_THRESHOLD)
};

// ── Normalisation du champ `sex` ─────────────────────────────────────────────
// Le champ Person.sex est un string libre, incohérent selon l'origine :
//   - perso créé par le joueur (NewGamePage) : "M" / "F" / "O"
//   - NPC générés (faker.person.sex())       : "male" / "female"
export type Morph = "male" | "female" | "neutral";

export const normalizeSex = (sex?: string): Morph => {
  const s = (sex ?? "").trim().toLowerCase();
  if (s === "m" || s === "male" || s === "masculin" || s === "homme")
    return "male";
  if (
    s === "f" ||
    s === "female" ||
    s === "féminin" ||
    s === "feminin" ||
    s === "femme"
  )
    return "female";
  return "neutral"; // "O" / Autre / valeur inattendue
};
