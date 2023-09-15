import { Building } from "@/data/interface";
import { faker, allLocales } from "@faker-js/faker";
import { randomIntFromInterval } from "@/data/utils";

export const generateNewBuilding = (reputation: number): Building[] => {
    let nbGenerated = 3;
    if (reputation > 25) nbGenerated = 5;
    if (reputation > 50) nbGenerated = 7;
    if (reputation > 75) nbGenerated = 9;
    if (reputation === 10) nbGenerated = 15;

    let generated: Building[] = [];
    for (let i = 0; i < nbGenerated; i++) {
        let time = randomIntFromInterval(1, 8);
        let nbPlace = randomIntFromInterval(time + 2, time * 4);
        let price = randomIntFromInterval(nbPlace * 8000, nbPlace * 10250);
        let energyPrice = randomIntFromInterval(nbPlace * 120, nbPlace * 240);

        let address = { adr1: faker.location.street(), adr2: faker.location.secondaryAddress(), city: faker.location.city(), country: faker.location.country() };
        generated.push({
            id: i + 1,
            name: faker.location.street(),
            energyPrice: energyPrice,
            address,
            place: nbPlace,
            price,
            image: faker.image.urlLoremFlickr({ category: "building" }),
        });
    }
    return generated;
};
