import dayjs from "dayjs";
import "dayjs/locale/fr";

import {
  Candidate,
  CandidateSearchInfo,
  ComponentType,
  PersonType,
  ProductionPerson,
} from "@/data/interface";
import { Megaphone, ShieldCheck, ViewGrid } from "iconoir-react";

import { SEARCH_ROLES, SearchRole } from "@/data/utils/recruitment";
import { COMPONENT_ICON } from "@/components/component";

// ─────────────────────────────────────────────────────────────────────────────
// Dossiers du Pôle Emploi : les profils ramenés par une même recherche.
// Un dossier vit tant qu'il lui reste des candidats ; les profils des
// sauvegardes antérieures aux dossiers forment un dossier « sans recherche ».
// ─────────────────────────────────────────────────────────────────────────────

/** Clé d'URL du dossier des profils sans recherche connue. */
export const LOOSE_DOSSIER_KEY = "divers";

/** Libellé au pluriel d'un poste : titre de groupe et de dossier. */
export const ROLE_GROUP_LABEL: Record<SearchRole, string> = {
  FULLSTACK: "Polyvalents",
  [ComponentType.CODE]: "Développeurs",
  [ComponentType.VISUEL]: "Graphistes",
  [ComponentType.UX]: "Designers UX",
  [PersonType.QA]: "QA",
  [PersonType.MARKETING]: "Marketing",
};

/** Icône d'un poste (chemises, tuiles de la recherche). */
export const ROLE_ICON: Record<SearchRole, typeof ViewGrid> = {
  FULLSTACK: ViewGrid,
  [ComponentType.CODE]: COMPONENT_ICON[ComponentType.CODE],
  [ComponentType.VISUEL]: COMPONENT_ICON[ComponentType.VISUEL],
  [ComponentType.UX]: COMPONENT_ICON[ComponentType.UX],
  [PersonType.QA]: ShieldCheck,
  [PersonType.MARKETING]: Megaphone,
};

/** Pastille d'un poste : couleur du type ou du rôle (texte lisible dessus). */
export const ROLE_DOT: Record<SearchRole, string> = {
  FULLSTACK: "bg-role-prod",
  [ComponentType.CODE]: "bg-code text-white",
  [ComponentType.VISUEL]: "bg-visuel text-white",
  [ComponentType.UX]: "bg-ux text-white",
  [PersonType.QA]: "bg-role-qa",
  [PersonType.MARKETING]: "bg-role-marketing",
};

/** Poste d'un candidat, au sens des groupes du vivier. */
export const roleOf = (c: Candidate): SearchRole =>
  c.personType === PersonType.PROD
    ? ((c as ProductionPerson).specialty ?? "FULLSTACK")
    : (c.personType as SearchRole);

export interface Dossier {
  /** Clé d'URL : identifiant de la recherche, ou LOOSE_DOSSIER_KEY. */
  key: string;
  /** Recherche d'origine ; absente pour le dossier des profils sans recherche. */
  search?: CandidateSearchInfo;
  candidates: Candidate[];
}

/** Regroupe le vivier par recherche, la plus récente d'abord. */
export const groupByDossier = (candidates: Candidate[]): Dossier[] => {
  const byKey = new Map<string, Dossier>();
  for (const c of candidates) {
    const key = c.search ? String(c.search.id) : LOOSE_DOSSIER_KEY;
    const dossier = byKey.get(key) ?? { key, search: c.search, candidates: [] };
    dossier.candidates.push(c);
    byKey.set(key, dossier);
  }
  return [...byKey.values()].sort(
    (a, b) => (b.search?.at ?? -1) - (a.search?.at ?? -1),
  );
};

/** Ordre d'affichage des postes dans un dossier mêlant plusieurs postes. */
export const ROLE_ORDER = SEARCH_ROLES;

/** Date de jeu lisible (« 14 avril »), depuis des heures de jeu. */
export const gameDateLabel = (hours: number): string =>
  dayjs("1970-01-01").add(hours, "h").locale("fr").format("D MMMM");

/** Temps restant avant le départ d'un profil (heures de jeu). */
export const remainingLabel = (hours: number): string => {
  if (hours <= 0) return "Expiré";
  if (hours < 24) return `${Math.ceil(hours)} h`;
  return `${Math.ceil(hours / 24)} j`;
};
