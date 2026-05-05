import { createSelector } from "@reduxjs/toolkit";
import type { RootState } from "@/data/redux/store";
import type { Building, Person, StartedContract } from "@/data/interface";

const selectEmployeList = (state: RootState) => state.employe.employeList;
const selectBuildingList = (state: RootState) => state.company.buildingList;
const selectTaskList = (state: RootState) => state.task.taskList;

export const selectFondateur = createSelector([selectEmployeList], (list) =>
  list.find((e: Person) => e.id === 1),
);

export const selectEmployesByBuilding = createSelector(
  [selectEmployeList, (_: RootState, buildingId: number) => buildingId],
  (employeList, buildingId) =>
    employeList.filter((e: Person) => e.buildingId === buildingId),
);

export const selectEmployeById = createSelector(
  [
    selectEmployeList,
    (_: RootState, employeId: number | null | undefined) => employeId,
  ],
  (employeList, id) =>
    id == null ? undefined : employeList.find((e: Person) => e.id === id),
);

export const selectBuildingById = createSelector(
  [
    selectBuildingList,
    (_: RootState, buildingId: number | undefined) => buildingId,
  ],
  (buildings, id) =>
    id == null ? undefined : buildings.find((b: Building) => b.id === id),
);

export const selectTasksForBuilding = createSelector(
  [selectTaskList, (_: RootState, buildingId: number) => buildingId],
  (tasks, buildingId) =>
    tasks.filter((t: StartedContract) => t.buildingIds?.includes(buildingId)),
);

export const selectEmployesWithoutFondateur = createSelector(
  [selectEmployeList],
  (list) => list.filter((e: Person) => e.id !== 1),
);
