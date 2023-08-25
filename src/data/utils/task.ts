import { Contract } from "@/data/interface";
import { faker } from "@faker-js/faker/locale/en";
import { capitalize, randomIntFromInterval } from "@/data/utils";

export const generateNewContract = (reputation: number): Contract[] => {
    let nbGenerated = 3;
    if (reputation > 25) nbGenerated = 5;
    if (reputation > 50) nbGenerated = 7;
    if (reputation > 75) nbGenerated = 9;
    if (reputation === 10) nbGenerated = 15;

    let generated: Contract[] = [];
    /* TODO - Create Realistic Brand */
    for (let i = 0; i < nbGenerated; i++) {

        let time = randomIntFromInterval(1, 8);
        let priceDeposit = randomIntFromInterval(time * 1000, time * 1250)
        let priceAdditional = randomIntFromInterval(time * 4000, time * 8000)
        let priceMalus = randomIntFromInterval(priceDeposit * 2, priceDeposit * 3)

        generated.push({
            id: i + 1,
            priority: 1,
            name: capitalize(faker.hacker.ingverb()) + " " + faker.hacker.adjective() + " " + faker.hacker.noun(),

            time: time,
            priceDeposit: priceDeposit,
            priceAdditional: priceAdditional,
            priceMalus: priceMalus,

            clientName: faker.company.name(),
            clientImage: faker.image.urlLoremFlickr({ category: "logo" }),
        });
    }
    return generated;
};
