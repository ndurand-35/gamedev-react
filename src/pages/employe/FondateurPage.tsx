import { ReactElement } from "react";

import { FondateurInfo } from "@/components/employe";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { pageTopMenuItems } from "../EmployePage";

export const FondateurPage: React.FC = (): ReactElement => {
  useTopMenu(pageTopMenuItems);
  return (
    <div className="p-8 mt-14 mb-20">
      <FondateurInfo />
    </div>
  );
};
