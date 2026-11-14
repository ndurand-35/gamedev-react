import { TopMenuItem } from "@/data/interface";

// Sous-menu commun à la section Employés (même contrat que les autres
// sections : une constante de module, stable entre deux rendus, passée à
// `useTopMenu` par les pages et lue par le dock du bas).
export const employeTopMenuItems: TopMenuItem[] = [
  { name: "Tableau de bord", link: "/game/employe" },
  { name: "Employés", link: "/game/employe/list" },
  { name: "Pôle Emploi", link: "/game/employe/recruit" },
];
