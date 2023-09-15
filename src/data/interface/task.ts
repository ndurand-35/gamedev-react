export interface Task {
    id: number;
    name: string;
}

export interface StartedTask extends Task {
    startDate: number;
    paused: boolean;
    progression: number;

    priority: number;
    buildingIds?: number[] | null;
}

export interface Contract extends Task {
    time: number;

    clientName: string;
    clientImage: string;

    priceDeposit: number;
    priceAdditional: number;
    priceMalus: number;
}

export interface StartedContract extends StartedTask, Contract { }
