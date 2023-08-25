import dayjs, { Dayjs } from "dayjs";

export const getTimeAsDate = (time: number): Dayjs => {
    let startDate = dayjs("1970-01-01");
    return startDate.add(time, "h");
}