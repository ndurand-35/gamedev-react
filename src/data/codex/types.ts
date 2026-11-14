// ── Codex : encyclopédie du jeu ──────────────────────────────────────────────
// Décrit les mécaniques et les éléments du jeu, pour que les écrans n'aient
// plus à s'expliquer eux-mêmes : un « ? » discret renvoie à l'entrée du codex.
//
// Règles de rédaction (communes à toutes les entrées) :
//  • décrire ce que le joueur observe et les règles qui guident ses choix ;
//  • ne jamais révéler l'information cachée (vraies stats d'un candidat,
//    seuils de négociation, formules internes, tirages) ni donner de
//    stratégie : l'analyse est une récompense de progression (compétences
//    du fondateur) ;
//  • ton encyclopédique, impersonnel, au présent, sans « vous » ni « tu » ;
//  • phrases courtes ; **gras** pour les termes clés.

import type { FounderSkillId } from "@/data/utils/research";

export type CodexCategory =
  | "bases"
  | "production"
  | "contrats"
  | "produits"
  | "marche"
  | "equipe"
  | "entreprise";

export const CODEX_CATEGORIES: { id: CodexCategory; label: string }[] = [
  { id: "bases", label: "Bases" },
  { id: "production", label: "Production" },
  { id: "contrats", label: "Contrats" },
  { id: "produits", label: "Produits" },
  { id: "marche", label: "Marché" },
  { id: "equipe", label: "Équipe" },
  { id: "entreprise", label: "Entreprise" },
];

/** Bloc de contenu. Le texte accepte le **gras** (seule mise en forme). */
export type CodexBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; head: string[]; rows: string[][] };

export interface CodexEntry {
  /** Identifiant stable, en kebab-case (sert aux liens « ? » des écrans). */
  id: string;
  category: CodexCategory;
  title: string;
  /** Une phrase : affichée dans la liste et dans l'infobulle des liens. */
  summary: string;
  body: CodexBlock[];
  /** Entrées liées (identifiants), affichées en bas de l'entrée. */
  related?: string[];
  /**
   * Entrée réservée au fondateur qui a acquis cette compétence (le codex ne
   * dévoile pas une analyse que le joueur n'a pas encore débloquée).
   */
  requiresSkill?: FounderSkillId;
}
