import { ReactElement, useState } from "react";

import { EmployeList, PoleEmploye } from "@/components/employe";

interface ModalTab {
  key: string;
  menuTitle: string;
  title: string;
  component: ReactElement;
}

const modalTabList: ModalTab[] = [
  {
    key: "EMP",
    menuTitle: "Employé",
    title: "Employé",
    component: <EmployeList />,
  },
  {
    key: "PE",
    menuTitle: "Pole Emploi",
    title: "Pole Emploi",
    component: <PoleEmploye />,
  },
];

export const EmployePage: React.FC = (): ReactElement => {
  const [activeTab, setActiveTab] = useState<string>("EMP");
  return (
    <div className="p-8">
      <div className="flex flex-row">
        <ul className="menu bg-base-200 rounded-box space-y-2 min-w-fit">
          {modalTabList.map((modalTab: ModalTab) => (
            <li>
              <a
                className={activeTab === modalTab.key ? "active" : ""}
                onClick={() => setActiveTab(modalTab.key)}
              >
                {modalTab.menuTitle}
              </a>
            </li>
          ))}
        </ul>
        {modalTabList
          .filter((modalTab: ModalTab) => modalTab.key == activeTab)
          .map((modalTab: ModalTab) => (
            <div className="px-8 pt-2 pb-8 w-full">{modalTab.component}</div>
          ))}
      </div>
    </div>
  );
};
