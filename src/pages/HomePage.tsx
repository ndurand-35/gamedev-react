import { ReactElement, useEffect, useState } from "react";

import { BuildingPicker, BuildingDetail } from "@/components/building";
import { SpeedDial } from "@/components/layout";
import { TopMenuItem } from "@/data/interface";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { useAppSelector } from "@/data/redux/hooks";

const pageTopMenuItems: TopMenuItem[] = [];

export const HomePage: React.FC = (): ReactElement => {
  useTopMenu(pageTopMenuItems);
  const buildings = useAppSelector((s) => s.company.buildingList);
  const [selectedId, setSelectedId] = useState<number | undefined>(
    buildings[0]?.id,
  );

  useEffect(() => {
    if (buildings.length === 0) {
      if (selectedId !== undefined) setSelectedId(undefined);
      return;
    }
    if (selectedId == null || !buildings.find((b) => b.id === selectedId)) {
      setSelectedId(buildings[0].id);
    }
  }, [buildings, selectedId]);

  return (
    <div className="p-4 mt-14 mb-14">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[18rem_1fr]">
        <aside>
          <BuildingPicker
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>
        <main>
          <BuildingDetail buildingId={selectedId} />
        </main>
      </div>
      <SpeedDial />
    </div>
  );
};
