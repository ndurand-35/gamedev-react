import { ReactElement } from "react";
import { Clock } from "iconoir-react";

import { Building } from "@/data/interface";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { setBuildingSchedule } from "@/data/redux/companySlice";
import {
  WORK_SCHEDULES,
  WORK_SCHEDULE_ORDER,
  WorkSchedule,
  isWorkingHour,
  scheduleOf,
  shiftsLabel,
} from "@/data/utils/workSchedule";

// Couleur du sélecteur : on voit d'un coup d'œil qu'un studio tourne en crunch.
const TONE: Record<WorkSchedule, string> = {
  DETENTE: "select-success text-success",
  NORMAL: "",
  SOUTENU: "select-warning text-warning",
  CRUNCH: "select-error text-error font-bold",
};

const signed = (n: number): string =>
  n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0";

/** Effets chiffrés d'un rythme, en une ligne (infobulle). */
const scheduleEffects = (s: WorkSchedule): string => {
  const d = WORK_SCHEDULES[s];
  const parts = [
    `production ×${d.output.toLocaleString("fr-FR")}`,
    `moral ${signed(d.morale)}/mois`,
  ];
  if (d.quality !== 0) {
    parts.push(`qualité ${d.quality < 0 ? "−" : "+"}½ cran`);
  }
  return `${d.description} (${parts.join(", ")}) — ${shiftsLabel(s)}`;
};

/** Rythme de travail d'un studio : de la semaine de quatre jours au crunch. */
export const WorkScheduleSelect = ({
  building,
}: {
  building: Building;
}): ReactElement => {
  const dispatch = useAppDispatch();
  const current = scheduleOf(building);
  const time = useAppSelector((s) => s.engine.time);
  const open = isWorkingHour(current, time);
  return (
    <span className="flex items-center gap-2">
      <label
        className="flex items-center gap-2 text-sm font-bold text-base-content/70"
        title={scheduleEffects(current)}
      >
        <Clock width={16} height={16} />
        Rythme
        <select
          className={`select select-sm w-auto ${TONE[current]}`}
          value={current}
          onChange={(e) =>
            dispatch(
              setBuildingSchedule({
                id: building.id,
                schedule: e.target.value as WorkSchedule,
              }),
            )
          }
        >
          {WORK_SCHEDULE_ORDER.map((s) => (
            <option key={s} value={s} title={scheduleEffects(s)}>
              {WORK_SCHEDULES[s].label} · {WORK_SCHEDULES[s].weeklyHours} h
            </option>
          ))}
        </select>
      </label>
      {/* Hors horaires, les barres d'avancement sont figées : on dit pourquoi. */}
      <span
        className={`badge badge-sm ${open ? "badge-success" : "badge-ghost"}`}
        title={shiftsLabel(current)}
      >
        {open ? "Au bureau" : "Fermé"}
      </span>
    </span>
  );
};
