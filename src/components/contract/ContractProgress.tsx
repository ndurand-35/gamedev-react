import { FC, ReactElement } from "react";

import { NavArrowDown, NavArrowUp } from "iconoir-react";

import {
  QUALITY_BADGE_CLASS,
  QUALITY_LABELS,
  StartedContract,
  qualityFromAverage,
} from "@/data/interface";
import { MAX_TASK_PRIORITY, setTaskPriority } from "@/data/redux/taskSlice";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";

interface ContractProgressProps {
  contract: StartedContract;
}

export const ContractProgress: FC<ContractProgressProps> = ({
  contract,
}): ReactElement => {
  const dispatch = useAppDispatch();
  const time = useAppSelector((state) => state.engine.time);

  const canIncrease = contract.priority < MAX_TASK_PRIORITY;
  const canDecrease = contract.priority > 1;
  const hoursLeft = contract.startDate + contract.time - time;
  const daysLeft = Math.max(0, Math.round(hoursLeft / 24));
  const elapsed = time - contract.startDate;
  const earlyEligible = elapsed < contract.time * 0.7;
  const deadlineTone =
    hoursLeft <= 0
      ? "text-error"
      : hoursLeft < 24
        ? "text-warning"
        : earlyEligible
          ? "text-success"
          : "";

  return (
    <div className="flex flex-row items-center space-x-4 px-4 p-2">
      <div className="flex flex-col w-full space-y-1">
        <div className="flex flex-row justify-between items-center">
          <p>{contract.name}</p>
          <span
            className={`badge badge-sm ${QUALITY_BADGE_CLASS[qualityFromAverage(contract.averageQuality)]}`}
            title="Qualité moyenne des composants utilisés"
          >
            {QUALITY_LABELS[qualityFromAverage(contract.averageQuality)]}
          </span>
        </div>
        <progress
          className="progress h-4 transition-transform duration-75"
          value={contract.progression}
          max="100"
        />
        <p className={"text-sm " + deadlineTone}>
          {hoursLeft <= 0
            ? "Deadline dépassée"
            : `${daysLeft} jour${daysLeft > 1 ? "s" : ""} restant${daysLeft > 1 ? "s" : ""}`}
          {earlyEligible && hoursLeft > 0 && (
            <span className="ml-2 badge badge-xs badge-success">
              bonus livraison anticipée
            </span>
          )}
        </p>
      </div>
      <div className="flex flex-col items-center justify-center">
        <button
          type="button"
          aria-label="Augmenter la priorité"
          disabled={!canIncrease}
          className={
            canIncrease
              ? "cursor-pointer hover:text-primary"
              : "text-gray-300 cursor-not-allowed"
          }
          onClick={() =>
            dispatch(
              setTaskPriority({
                task: contract,
                priority: contract.priority + 1,
              }),
            )
          }
        >
          <NavArrowUp height={16} />
        </button>
        {contract.priority}
        <button
          type="button"
          aria-label="Diminuer la priorité"
          disabled={!canDecrease}
          className={
            canDecrease
              ? "cursor-pointer hover:text-primary"
              : "text-gray-300 cursor-not-allowed"
          }
          onClick={() =>
            dispatch(
              setTaskPriority({
                task: contract,
                priority: contract.priority - 1,
              }),
            )
          }
        >
          <NavArrowDown height={16} />
        </button>
      </div>
    </div>
  );
};
