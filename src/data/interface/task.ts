export interface Task {
    id: number;
    name: string;
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
