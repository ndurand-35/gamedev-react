// Interface générique pour les attributs communs à tous les employés
export interface Person {
    id: number;
    sex: string;
    firstName: string;
    lastName: string;
    salary: number;
}

// Interface spécifique pour les développeurs (Developer)
export interface Developer extends Person {
    frontStat: number;
    frontMaxStat: number;
    backStat: number;
    backMaxStat: number;
    debugStat: number;
    debugMaxStat: number;
}

// Interface spécifique pour les designers (Designer)
export interface Designer extends Person {
    creativityStat: number;
    creativityMaxStat: number;
    visualDesignStat: number;
    visualDesignMaxStat: number;
    animationStat: number;         // Nouvelle compétence : Animation
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



export interface Candidate extends Person {

}



export interface Employe extends Person {
	buildingId: number;
}
