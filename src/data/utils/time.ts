import dayjs, { Dayjs } from "dayjs";

export const getTimeAsDate = (time: number): Dayjs => {
  let startDate = dayjs("1970-01-01");
  return startDate.add(time, "h");
};

export const weekToHour = (week: number): number => {
  return week * 7 * 24;
};

export const hourToWeek = (hour: number): string => {
  return (hour / 7 / 24).toFixed(0);
};
export const hourToDay = (hour: number): string => {
  return (hour / 24).toFixed(0);
};
