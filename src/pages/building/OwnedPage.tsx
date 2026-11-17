import { ReactElement } from "react";

import { BuildingTable } from "@/components/building/BuildingTable";
import { CompatibilityGrids } from "@/components/building/CompatibilityGrid";
import { SectionTabs } from "@/components/layout/SectionTabs";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { buildingTopMenuItems } from "@/pages/building/menu";

export const OwnedPage: React.FC = (): ReactElement => {
  useTopMenu(buildingTopMenuItems);
  return (
    <div className="page-shell">
      <SectionTabs items={buildingTopMenuItems} ariaLabel="Section Bâtiments" />
      <div className="toy-frame page-frame space-y-5">
        <BuildingTable />
        <CompatibilityGrids />
      </div>
    </div>
  );
};
