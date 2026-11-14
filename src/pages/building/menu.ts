import { TopMenuItem } from "@/data/interface";

// Sous-menu commun à la section Bâtiments (même contrat que les autres
// sections : une constante de module, stable entre deux rendus, passée à
// `useTopMenu` par les pages et lue par le dock du bas).
export const buildingTopMenuItems: TopMenuItem[] = [
  { name: "Tableau de bord", link: "/game/building" },
  { name: "Mes bâtiments", link: "/game/building/owned" },
  { name: "SeLoger", link: "/game/building/buy" },
];
