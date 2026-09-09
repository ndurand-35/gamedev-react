import { TopMenuItem } from "@/data/interface";

// Sous-menu commun à la section Finance (même contrat que les autres sections :
// une constante de module, stable entre deux rendus, passée à `useTopMenu`).
export const financeTopMenuItems: TopMenuItem[] = [
  { name: "Vue d'ensemble", link: "/game/finance" },
  { name: "Banque", link: "/game/finance/bank" },
];
