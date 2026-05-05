import { ReactElement } from "react";

import { PoleEmploye } from "@/components/employe";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { pageTopMenuItems } from "../EmployePage";

export const PoleEmploiPage: React.FC = (): ReactElement => {
  useTopMenu(pageTopMenuItems);
  return (
    <div className="p-8 mt-14 mb-20">
      <PoleEmploye />
    </div>
  );
};
