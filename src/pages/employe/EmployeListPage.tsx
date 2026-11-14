import { ReactElement } from "react";

import { EmployeList } from "@/components/employe";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { employeTopMenuItems } from "@/pages/employe/menu";
import { SectionTabs } from "@/components/layout/SectionTabs";

export const EmployeListPage: React.FC = (): ReactElement => {
  useTopMenu(employeTopMenuItems);
  return (
    <div className="page-shell">
      <SectionTabs items={employeTopMenuItems} ariaLabel="Section Employés" />
      <div className="toy-frame page-frame">
        <EmployeList />
      </div>
    </div>
  );
};
