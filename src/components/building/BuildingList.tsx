import { useSelector } from "react-redux";

import { RootState } from "@/data/redux/store";
import { Building } from "@/data/class";
import { BuildingCard } from "./BuildingCard";

export const BuildingList = () => {
	const buildingList = useSelector((state: RootState) => state.company.buildingList);

	return (
		<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
			{buildingList.map((building: Building, index: number) => (
				<div key={`building_${index}`}>
					<BuildingCard building={building} />
				</div>
			))}
		</div>
	);
};
