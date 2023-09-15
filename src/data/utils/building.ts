import { Building } from "@/data/interface";
import { faker } from "@faker-js/faker";

export const generateNewBuilding = (reputation: number): Building[] => {
    let nbGenerated = 3;
    if (reputation > 25) nbGenerated = 5;
    if (reputation > 50) nbGenerated = 7;
    if (reputation > 75) nbGenerated = 9;
    if (reputation === 10) nbGenerated = 15;

    let generated: Building[] = [];
    for (let i = 0; i < nbGenerated; i++) {
        generated.push({ id: i + 1, name: faker.location.street(), energyPrice: 400, place: 40, price: 2000000 });
    }
    return generated;
};
