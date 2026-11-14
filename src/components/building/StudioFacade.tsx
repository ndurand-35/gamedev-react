import { FC, ReactElement } from "react";

import { Building } from "@/data/interface";
import {
  FACADE_GROUND,
  FACADE_HEIGHT,
  FACADE_WIDTH,
  studioFacade,
} from "@/data/utils/facade";
import {
  STUDIO_KINDS,
  inferStudioKind,
  studioFloors,
} from "@/data/utils/studioListing";

const INK = "var(--color-ink)";
const GLASS = "#D3E2E2";

interface StudioFacadeProps {
  building: Pick<Building, "kind" | "place" | "floors">;
  className?: string;
}

/** Façade d'un studio, dessinée d'après son type, ses niveaux et ses places. */
export const StudioFacade: FC<StudioFacadeProps> = ({
  building,
  className,
}): ReactElement => {
  const paths = studioFacade(building);
  const kind = inferStudioKind(building);
  const floors = studioFloors(building);
  const label =
    kind === "PENICHE"
      ? STUDIO_KINDS[kind].label
      : `${STUDIO_KINDS[kind].label}, ${floors} niveau${floors > 1 ? "x" : ""}`;

  return (
    <svg
      viewBox={`0 0 ${FACADE_WIDTH} ${FACADE_HEIGHT}`}
      role="img"
      aria-label={label}
      className={className}
    >
      <path d={paths.water} fill={GLASS} stroke={INK} strokeWidth={2} />
      <path
        d={paths.roof}
        fill="var(--color-base-300)"
        stroke={INK}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path
        d={paths.body}
        fill="var(--color-base-100)"
        stroke={INK}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <path d={paths.windows} fill={GLASS} stroke={INK} strokeWidth={2} />
      <path
        d={paths.door}
        fill="var(--color-sun)"
        stroke={INK}
        strokeWidth={2}
      />
      <path d={paths.lines} fill="none" stroke={INK} strokeWidth={1.5} />
      <path
        d={`M0 ${FACADE_GROUND}H${FACADE_WIDTH}`}
        fill="none"
        stroke={INK}
        strokeWidth={2.5}
      />
    </svg>
  );
};
