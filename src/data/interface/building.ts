import { Employee } from "@/data/interface";

export interface Building {
	name: string;
	price: number;
	place: number;
	energyPrice: number;

	employeList: Employee[];
}
