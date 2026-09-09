import { TopMenuItem } from "@/data/interface";

// Sous-menu commun à la section Production (même contrat que les autres
// sections : une constante de module, stable entre deux rendus, passée à
// `useTopMenu`). Produits et contrats puisent dans le même stock de composants,
// d'où leur regroupement sous une seule entrée de navigation.
export const productTopMenuItems: TopMenuItem[] = [
  { name: "Produits", link: "/game/product" },
  { name: "Contrats", link: "/game/product/contract" },
];
