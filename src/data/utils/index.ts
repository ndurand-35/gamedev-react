export function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export function randomIntFromInterval(min: number, max: number): number { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
}
