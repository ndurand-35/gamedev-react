import { ReactElement } from "react";

import { BuildingTable } from "@/components/building/BuildingTable";
import { TopMenuItem } from "@/data/interface";
import { useTopMenu } from "@/data/hooks/useTopMenu";

const pageTopMenuItems: TopMenuItem[] = [
  { name: "Accueil", link: "/game/building" },
  { name: "Mes bâtiments", link: "/game/building/owned" },
  { name: "SeLoger", link: "/game/building/buy" },
];

export const OwnedPage: React.FC = (): ReactElement => {
  useTopMenu(pageTopMenuItems);
  return (
    <div className="p-8 mt-14 mb-20">
      <BuildingTable />
    </div>
  );
};
