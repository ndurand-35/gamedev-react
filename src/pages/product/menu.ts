import { TopMenuItem } from "@/data/interface";

// Sous-menu commun à la section Production (même contrat que les autres
// sections : une constante de module, stable entre deux rendus, passée à
// `useTopMenu`). Le stock de composants, les produits qui le consomment et les
// contrats qui le livrent forment une seule chaîne : une seule entrée de
// navigation, trois onglets.
export const productTopMenuItems: TopMenuItem[] = [
  { name: "Composants", link: "/game/component" },
  { name: "Produits", link: "/game/product" },
  { name: "Contrats", link: "/game/product/contract" },
];
