import { FC } from "react";

import {
  COMPATIBILITY_LABEL,
  CompatibilityLevel,
} from "@/data/utils/compatibility";
import { COMPATIBILITY_CLASS } from "@/components/employe/compatibilityStyle";

/** Pastille d'entente entre deux personnes. */
export const CompatibilityChip: FC<{ level: CompatibilityLevel }> = ({
  level,
}) => (
  <span
    className={
      "inline-flex shrink-0 items-center rounded-full border-2 px-2 py-px text-xs font-extrabold whitespace-nowrap " +
      COMPATIBILITY_CLASS[level]
    }
  >
    {COMPATIBILITY_LABEL[level]}
  </span>
);
