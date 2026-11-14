import { ReactElement } from "react";
import { BeachBag } from "iconoir-react";
import "dayjs/locale/fr";

import { Person } from "@/data/interface";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { getTimeAsDate } from "@/data/utils/time";
import {
  LEAVE_BLOCKER_LABEL,
  LEAVE_OPTIONS,
  leaveBlocker,
  sendOnLeave,
} from "@/data/utils/leave";

/**
 * Congés payés : une ou deux semaines d'absence, le moral regagné au retour.
 * Absent, l'employé affiche sa date de retour à la place du choix.
 */
export const LeaveButton = ({
  employe,
}: {
  employe: Person;
}): ReactElement => {
  const dispatch = useAppDispatch();
  const blocker = useAppSelector((s) => leaveBlocker(employe, s));

  if (employe.leaveUntil != null) {
    return (
      <span className="badge h-9 gap-1.5 border-info/40 bg-info/10 px-3 text-info">
        <BeachBag width={16} height={16} />
        En congés jusqu'au{" "}
        {getTimeAsDate(employe.leaveUntil).locale("fr").format("D MMMM")}
      </span>
    );
  }

  if (blocker) {
    return (
      <div className="tooltip" data-tip={LEAVE_BLOCKER_LABEL[blocker]}>
        <button type="button" className="btn" disabled>
          <BeachBag width={16} height={16} />
          Congés
        </button>
      </div>
    );
  }

  return (
    <div className="dropdown dropdown-top">
      <div tabIndex={0} role="button" className="btn">
        <BeachBag width={16} height={16} />
        Congés
      </div>
      <ul
        tabIndex={0}
        className="dropdown-content menu toy-pill z-10 mb-2 w-60 rounded-box p-1.5"
      >
        {LEAVE_OPTIONS.map((option) => (
          <li key={option.days}>
            <button
              type="button"
              className="justify-between"
              onClick={(e) => {
                dispatch(sendOnLeave(employe.id, option));
                e.currentTarget.blur();
              }}
            >
              {option.label}
              <span className="badge badge-sm bg-white">
                moral +{option.morale}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
