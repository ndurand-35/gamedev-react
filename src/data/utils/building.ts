import {
  Building,
  Employe,
  getBuildingMonthlyCharges,
  getBuildingResaleValue,
} from "@/data/interface";
import { faker } from "@faker-js/faker";
import { randomIntFromInterval, formatPrice } from "@/data/utils";
import { releaseBuilding } from "@/data/redux/companySlice";
import { pushNotification } from "@/data/redux/notificationSlice";
import { AppDispatch, RootState } from "@/data/redux/store";
import { SortState, nextSort, sortBy } from "@/data/utils/sort";

export const generateNewBuilding = (reputation: number): Building[] => {
  let nbGenerated = 3;
  if (reputation >= 25) nbGenerated = 5;
  if (reputation >= 50) nbGenerated = 7;
  if (reputation >= 75) nbGenerated = 9;
  if (reputation === 100) nbGenerated = 15;

  let generated: Building[] = [];
  for (let i = 0; i < nbGenerated; i++) {
    let time = randomIntFromInterval(1, 8);
    let nbPlace = randomIntFromInterval(time + 2, time * 4);
    let price = randomIntFromInterval(nbPlace * 8000, nbPlace * 10250);
    let rent = randomIntFromInterval(nbPlace * 80, nbPlace * 160);
    let electricity = randomIntFromInterval(nbPlace * 25, nbPlace * 60);
    let internet = randomIntFromInterval(30, 80);

    let address = {
      adr1: faker.location.street(),
      adr2: faker.location.secondaryAddress(),
      city: faker.location.city(),
      country: faker.location.country(),
    };
    generated.push({
      id: 0, // assigné par le slice via nextBuildingId
      name: faker.location.street(),
      rent,
      electricity,
      internet,
      address,
      place: nbPlace,
      price,
      image: faker.image.urlLoremFlickr({ category: "building" }),
    });
  }
  return generated;
};
export const getBuildingEmploye = (
  employeList: Employe[],
  building: Building,
): Employe[] => {
  return employeList.filter((employe) => employe.buildingId === building.id);
};

/** On ne se sépare que de locaux vides : personne n'est déplacé d'office. */
export const canReleaseBuilding = (
  building: Building,
  employeList: Employe[],
): boolean => getBuildingEmploye(employeList, building).length === 0;

/**
 * Libère un bâtiment vide : la valeur de revente est créditée et ses charges
 * cessent au prochain mois. Un bâtiment occupé est refusé sans rien changer,
 * le joueur doit d'abord réaffecter ses employés.
 */
export const releaseEmptyBuilding =
  (buildingId: number) =>
  (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    const building = state.company.buildingList.find(
      (b: Building) => b.id === buildingId,
    );
    if (!building) return;

    if (!canReleaseBuilding(building, state.employe.employeList)) {
      dispatch(
        pushNotification({
          message: `« ${building.name} » est encore occupé : réaffectez ses employés avant de le libérer.`,
          type: "error",
        }),
      );
      return;
    }

    const resale = getBuildingResaleValue(building);
    dispatch(releaseBuilding(buildingId));
    dispatch(
      pushNotification({
        message:
          resale > 0
            ? `« ${building.name} » libéré : ${formatPrice(resale)} € récupérés.`
            : `« ${building.name} » libéré.`,
        type: "success",
      }),
    );
  };

// ---------------------------------------------------------------------------
// Tri des annonces SeLoger — mécanique dans sort.ts
// ---------------------------------------------------------------------------

/** Colonnes triables des annonces ; les charges se trient sur leur total. */
export const BUILDING_SORT_ACCESSORS = {
  city: (b: Building) => b.address.city,
  country: (b: Building) => b.address.country,
  place: (b: Building) => b.place,
  charges: (b: Building) => getBuildingMonthlyCharges(b),
  price: (b: Building) => b.price,
} satisfies Record<string, (b: Building) => string | number>;

export type BuildingSortKey = keyof typeof BUILDING_SORT_ACCESSORS;

export type BuildingSort = SortState<BuildingSortKey>;

export const sortBuildings = (
  buildings: Building[],
  sort: BuildingSort | null,
): Building[] => sortBy(buildings, BUILDING_SORT_ACCESSORS, sort);

export const nextBuildingSort = (
  current: BuildingSort | null,
  key: BuildingSortKey,
): BuildingSort | null => nextSort(current, key);
