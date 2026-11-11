import { TopMenuItem } from "@/data/interface";

// Sous-menu commun à la section Entreprise (même contrat que les autres
// sections : une constante de module, stable entre deux rendus, passée à
// `useTopMenu`). Ce qui fait tourner la boîte hors production : la formation
// du fondateur, la trésorerie et la dette.
export const companyTopMenuItems: TopMenuItem[] = [
  { name: "Recherche / formation", link: "/game/research" },
  { name: "Finances", link: "/game/finance" },
  { name: "Banque", link: "/game/finance/bank" },
];
