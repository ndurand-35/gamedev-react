import { ProductGenre } from "@/data/interface/product";

/**
 * Un studio concurrent : une société qui existe sur le marché dès le début de
 * la partie, indépendamment de nos affaires avec elle.
 *
 * Aujourd'hui, c'est elle qui émet les contrats de la liste hebdomadaire ; le
 * carnet d'adresses (`Client`, indexé par le même `id`) mémorise ce qu'on lui
 * doit — palier de relation, livraisons, rupture. Les deux facettes restent
 * séparées : un studio rompu ne propose plus rien, mais il n'a pas disparu du
 * marché. C'est ce qui prépare l'étape suivante, où ces studios lanceront
 * leurs propres produits face aux nôtres.
 */
export interface Competitor {
  /** Identifiant stable, porté par tous les contrats de ce studio. */
  id: string;
  name: string;
  image: string;
}

/**
 * Produit lancé par un studio concurrent. Il n'a pas de composants ni de
 * stock : sa taille et sa qualité sont tirées au lancement et fixent son
 * attractivité, qui pèse dans le segment exactement comme celle des nôtres.
 * Il vieillit (même courbe de fraîcheur) et se retire à `retireAt`.
 */
export interface CompetitorProduct {
  id: number;
  competitorId: string;
  name: string;
  genre: ProductGenre;
  /** Composants équivalents. */
  size: number;
  /** Qualité moyenne équivalente (0..5). */
  quality: number;
  launchTime: number;
  /** Heure de jeu du retrait : un produit concurrent ne vit pas éternellement. */
  retireAt: number;
}
