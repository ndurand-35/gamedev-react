import { Candidate } from "@/data/interface";
import { SexType, faker } from "@faker-js/faker";
import { randomIntFromInterval } from "@/data/utils";

export const generateNewEmploye = (reputation: number): Candidate[] => {
    let nbGenerated = 3;
    if (reputation > 25) nbGenerated = 5;
    if (reputation > 50) nbGenerated = 7;
    if (reputation > 75) nbGenerated = 9;
    if (reputation === 10) nbGenerated = 15;

    let generated: Candidate[] = [];
    for (let i = 0; i < nbGenerated; i++) {
        let sex = faker.person.sex();
        generated.push({
            id: i + 1,
            sex,
            firstName: faker.person.firstName(sex as SexType),
            lastName: faker.person.firstName(sex as SexType),
            salary: randomIntFromInterval(1000, 2000),
        });
    }
    return generated;
};
