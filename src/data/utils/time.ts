import dayjs, { Dayjs } from "dayjs";

export const getTimeAsDate = (time: number): Dayjs => {
  let startDate = dayjs("1970-01-01");
  return startDate.add(time, "h");
};

/**
 * `engine.time` (heures) décalé de N mois calendaires. Sert aux projections
 * pluri-mensuelles : on avance le temps de jeu plutôt que de dupliquer les
 * formules qui en dépendent (obsolescence produit, expiration de campagne).
 */
export const addMonthsToTime = (time: number, months: number): number =>
  getTimeAsDate(time).add(months, "month").diff(dayjs("1970-01-01"), "hour");

export const weekToHour = (week: number): number => {
  return week * 7 * 24;
};

export const hourToWeek = (hour: number): string => {
  return (hour / 7 / 24).toFixed(0);
};
export const hourToDay = (hour: number): string => {
  return (hour / 24).toFixed(0);
};

// Durée de survie lisible dérivée de `engine.time` (heures de jeu), pour
// l'écran de bilan (WF-3). Ex. « 3 mois et 12 j », « 18 j », « 5 h ».
export const formatSurvival = (time: number): string => {
  const start = dayjs("1970-01-01");
  const end = getTimeAsDate(time);
  const months = end.diff(start, "month");
  const afterMonths = start.add(months, "month");
  const days = end.diff(afterMonths, "day");

  if (months > 0) {
    const m = `${months} mois`;
    return days > 0 ? `${m} et ${days} j` : m;
  }
  if (days > 0) return `${days} j`;
  return `${Math.max(0, Math.floor(time))} h`;
};
