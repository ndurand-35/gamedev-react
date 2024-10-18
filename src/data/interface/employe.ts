export enum PersonType {
    PROD = "Production",
}


export enum ProductionType {
    DEV = "Développeur",
    DESIGNER = "Designer",
}



// Interface générique pour les attributs communs à tous les employés
export interface Person {
    id: number;
    sex: string;
    firstName: string;
    lastName: string;
    salary: number;
    buildingId?: number;
    personType: PersonType;
}

export interface ProductionPerson extends Person {
    productionType: ProductionType;
    frontStat: number;
    frontMaxStat: number;
    backStat: number;
    backMaxStat: number;
    debugStat: number;
    debugMaxStat: number;

    creativityStat: number;
    creativityMaxStat: number;
    visualDesignStat: number;
    visualDesignMaxStat: number;
    animationStat: number;
    animationMaxStat: number;
}

// Interface spécifique pour le marketing (Marketing)
export interface Marketing extends Person {
    communicationStat: number;
    communicationMaxStat: number;
    campaignManagementStat: number;
    campaignManagementMaxStat: number;
}

// Interface spécifique pour les testeurs QA (Quality Assurance)
export interface QA extends Person {
    testStat: number;
    testMaxStat: number;
    bugDetectionStat: number;
    bugDetectionMaxStat: number;
}

// Interface spécifique pour les chefs de projet (Project Manager)
export interface ProjectManager extends Person {
    leadershipStat: number;
    leadershipMaxStat: number;
    organizationStat: number;
    organizationMaxStat: number;
}

// Interface spécifique pour le support client (Support)
export interface Support extends Person {
    customerSatisfactionStat: number;
    customerSatisfactionMaxStat: number;
    problemSolvingStat: number;
    problemSolvingMaxStat: number;
}