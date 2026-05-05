export * from "@/data/utils/time";
export * from "@/data/utils/task";
export * from "@/data/utils/building";
export * from "@/data/utils/employe";
export * from "@/data/utils/component";
export * from "@/data/utils/billing";
export * from "@/data/utils/training";
export * from "@/data/utils/events";

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function randomIntFromInterval(min: number, max: number): number {
  // min and max included
  return Math.floor(Math.random() * (max - min + 1) + min);
}

export function formatPrice(price: number): string {
  return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
