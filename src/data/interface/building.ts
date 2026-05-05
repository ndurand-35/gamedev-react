export interface Building {
  id: number;
  name: string;
  address: Address;
  price: number;
  place: number;
  rent: number;
  electricity: number;
  internet: number;
  image?: string | null;
}

export const getBuildingMonthlyCharges = (b: Building): number =>
  b.rent + b.electricity + b.internet;

// Bonus de synergie : plus d'employés dans un même bâtiment = production
// boostée. Calibré pour rester modeste (max +20%).
export const buildingSynergyMultiplier = (occupants: number): number => {
  if (occupants <= 1) return 1;
  if (occupants === 2) return 1.05;
  if (occupants === 3) return 1.1;
  if (occupants === 4) return 1.15;
  return 1.2;
};

export interface Address {
  adr1: string;
  adr2: string;
  city: string;
  country: string;
}
