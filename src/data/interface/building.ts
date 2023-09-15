export interface Building {
	id: number;
	name: string;
	address: Address;
	price: number;
	place: number;
	energyPrice: number;
	image?: string | null;
}

export interface Address {
	adr1: string;
	adr2: string;
	city: string;
	country: string;
}
