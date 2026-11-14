import { ReactElement } from "react";

import { PoleEmploye } from "@/components/employe";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { SectionTabs } from "@/components/layout/SectionTabs";
import { employeTopMenuItems } from "@/pages/employe/menu";

export const PoleEmploiPage: React.FC = (): ReactElement => {
  useTopMenu(employeTopMenuItems);
  return (
    <div className="page-shell">
      <SectionTabs items={employeTopMenuItems} ariaLabel="Section Employés" />
      <div className="toy-frame page-frame">
        <PoleEmploye />
      </div>
    </div>
  );
};
