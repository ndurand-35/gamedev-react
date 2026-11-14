import { ReactElement, useMemo } from "react";
import { Hourglass, Industry } from "iconoir-react";

import {
  Component,
  ComponentQuality,
  COMPONENT_TYPE_ORDER,
  ComponentType,
  QUALITY_LABELS,
  hoursBeforeNextDecay,
  qualityFromAverage,
} from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { productTopMenuItems } from "@/pages/product/menu";
import { productionSpeedMultiplier } from "@/data/utils/traits";
import { PRODUCTION_THRESHOLD } from "@/data/redux/componentSlice";
import { getRelevantStat, isProductionPerson } from "@/data/utils/component";
import { COMPONENT_ICON } from "@/components/component";
import { CodexLink } from "@/components/codex/CodexLink";
import { SectionTabs } from "@/components/layout/SectionTabs";

// ─────────────────────────────────────────────────────────────────────────────
// Stock de composants : un bac par type. En tête de bac, le stock ; dessous,
// le débit de production, la répartition des qualités, ce qui vieillit et la
// réputation du domaine.
// ─────────────────────────────────────────────────────────────────────────────

/** Pastille de l'icône du bac : la seule touche de couleur avec la jauge de
    réputation, pour que trois bacs côte à côte ne saturent pas l'écran. */
const TYPE_BAND_CLASS: Record<ComponentType, string> = {
  [ComponentType.CODE]: "bg-code",
  [ComponentType.VISUEL]: "bg-visuel",
  [ComponentType.UX]: "bg-ux",
};

/** Jauge de réputation, dans la couleur du type. */
const TYPE_FILL_CLASS = TYPE_BAND_CLASS;

/** Du meilleur au pire : l'ordre de lecture de la répartition. */
const QUALITY_ORDER: ComponentQuality[] = [
  ComponentQuality.EXCELLENT,
  ComponentQuality.TRES_BON,
  ComponentQuality.BON,
  ComponentQuality.CORRECT,
  ComponentQuality.MEDIOCRE,
  ComponentQuality.BACLE,
];

/** Qualité sur une échelle d'encre : plus c'est foncé, meilleur c'est. Le
    libellé et le nombre accompagnent toujours la teinte. */
const QUALITY_FILL_CLASS: Record<ComponentQuality, string> = {
  [ComponentQuality.BACLE]: "bg-ink/10",
  [ComponentQuality.MEDIOCRE]: "bg-ink/25",
  [ComponentQuality.CORRECT]: "bg-ink/40",
  [ComponentQuality.BON]: "bg-ink/60",
  [ComponentQuality.TRES_BON]: "bg-ink/80",
  [ComponentQuality.EXCELLENT]: "bg-ink",
};

const countByQuality = (
  list: Component[],
): Record<ComponentQuality, number> => {
  const counts = {
    [ComponentQuality.BACLE]: 0,
    [ComponentQuality.MEDIOCRE]: 0,
    [ComponentQuality.CORRECT]: 0,
    [ComponentQuality.BON]: 0,
    [ComponentQuality.TRES_BON]: 0,
    [ComponentQuality.EXCELLENT]: 0,
  };
  for (const c of list) counts[c.quality]++;
  return counts;
};

const averageQuality = (list: Component[]) =>
  list.length === 0
    ? 0
    : list.reduce((acc, c) => acc + c.quality, 0) / list.length;

export const ComponentPage: React.FC = (): ReactElement => {
  useTopMenu(productTopMenuItems);
  const stock = useAppSelector((state) => state.component.stock);
  const employeList = useAppSelector((state) => state.employe.employeList);
  const repByType = useAppSelector((s) => s.company.reputationByType);
  const time = useAppSelector((state) => state.engine.time);

  const grouped = useMemo(() => {
    const map: Record<ComponentType, Component[]> = {
      [ComponentType.CODE]: [],
      [ComponentType.VISUEL]: [],
      [ComponentType.UX]: [],
    };
    for (const c of stock) map[c.type].push(c);
    return map;
  }, [stock]);

  const productionPerDay = useMemo(() => {
    const map: Record<ComponentType, number> = {
      [ComponentType.CODE]: 0,
      [ComponentType.VISUEL]: 0,
      [ComponentType.UX]: 0,
    };
    for (const e of employeList) {
      if (!isProductionPerson(e)) continue;
      const type = e.assignedComponentType;
      if (!type) continue;
      if (e.buildingId == null) continue;
      map[type] +=
        (getRelevantStat(e, type) * productionSpeedMultiplier(e) * 24) /
        PRODUCTION_THRESHOLD;
    }
    return map;
  }, [employeList]);

  return (
    <div className="page-shell">
      <SectionTabs items={productTopMenuItems} ariaLabel="Section Production" />
      <div className="toy-frame page-frame space-y-5">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          Stock de composants <CodexLink id="obsolescence" />
        </h1>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {COMPONENT_TYPE_ORDER.map((type) => {
            const Icon = COMPONENT_ICON[type];
            const list = grouped[type];
            const avg = qualityFromAverage(averageQuality(list));
            const rate = productionPerDay[type];
            const counts = countByQuality(list);
            // Composants qui perdront un niveau de qualité dans la semaine.
            const aging = list.filter(
              (c) => hoursBeforeNextDecay(c, time) <= 7 * 24,
            ).length;
            const reputation = repByType[type] ?? 0;
            return (
              <section
                key={`stock_${type}`}
                aria-label={`Stock ${type}`}
                className="overflow-hidden rounded-[1.25rem] border-[3px] border-ink bg-white"
              >
                {/* Bandeau : le type et son stock */}
                <div className="flex items-center gap-3 border-b-2 border-base-300 px-4 py-3">
                  <span
                    className={`flex size-10 items-center justify-center rounded-full border-[2.5px] border-ink text-white ${TYPE_BAND_CLASS[type]}`}
                  >
                    <Icon width={20} height={20} strokeWidth={2.2} />
                  </span>
                  <h2 className="flex-1 font-display text-xl font-semibold">
                    {type}
                  </h2>
                  <span className="text-right leading-none">
                    <span className="block font-display text-4xl font-bold tabular-nums">
                      {list.length}
                    </span>
                    <span className="text-xs font-extrabold text-base-content/60">
                      en stock
                    </span>
                  </span>
                </div>

                <div className="space-y-4 p-4">
                  {/* Débit et qualité moyenne */}
                  <div className="flex flex-wrap items-center gap-2 text-sm font-extrabold">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-base-200 px-3 py-1">
                      <Industry width={15} height={15} strokeWidth={2.2} />
                      {rate > 0
                        ? `${rate.toFixed(1).replace(".", ",")} / jour`
                        : "Personne n'y travaille"}
                    </span>
                    {list.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-base-200 px-3 py-1">
                        <span
                          className={`size-2.5 rounded-full ${QUALITY_FILL_CLASS[avg]} ring-1 ring-ink/40`}
                        />
                        Moyenne {QUALITY_LABELS[avg].toLowerCase()}
                      </span>
                    )}
                  </div>

                  {/* Répartition des qualités, du meilleur au pire */}
                  {list.length === 0 ? (
                    <p className="rounded-xl border-2 border-dashed border-base-300 py-4 text-center text-sm font-bold text-base-content/60">
                      Aucun composant
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div
                        className="flex h-4 overflow-hidden rounded-full border-[2.5px] border-ink bg-base-300"
                        role="img"
                        aria-label={QUALITY_ORDER.filter((q) => counts[q] > 0)
                          .map((q) => `${QUALITY_LABELS[q]} : ${counts[q]}`)
                          .join(", ")}
                      >
                        {QUALITY_ORDER.filter((q) => counts[q] > 0).map(
                          (q, i, shown) => (
                            <span
                              key={q}
                              className={`block h-full border-ink ${QUALITY_FILL_CLASS[q]} ${i < shown.length - 1 ? "border-r-2" : ""}`}
                              style={{
                                width: `${(counts[q] / list.length) * 100}%`,
                              }}
                            />
                          ),
                        )}
                      </div>
                      <ul className="grid list-none grid-cols-3 gap-x-3 gap-y-1 p-0 text-xs font-bold">
                        {QUALITY_ORDER.map((q) => (
                          <li
                            key={q}
                            className={`flex items-center gap-1.5 ${counts[q] === 0 ? "text-base-content/40" : ""}`}
                          >
                            <span
                              className={`size-2.5 shrink-0 rounded-full ${QUALITY_FILL_CLASS[q]} ring-1 ring-ink/40 ${counts[q] === 0 ? "opacity-40" : ""}`}
                            />
                            <span className="truncate">
                              {QUALITY_LABELS[q]}
                            </span>
                            <span className="ml-auto font-extrabold tabular-nums">
                              {counts[q]}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aging > 0 && (
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-base-200 px-3 py-1 text-xs font-extrabold">
                      <Hourglass width={13} height={13} strokeWidth={2.4} />
                      {aging} perd{aging > 1 ? "ent" : ""} un niveau sous 7
                      jours
                    </p>
                  )}

                  {/* Réputation du domaine */}
                  <div className="space-y-1.5 border-t-[1.5px] border-dashed border-base-300 pt-3">
                    <div className="flex items-baseline justify-between text-sm font-extrabold">
                      <span>Réputation {type}</span>
                      <span className="tabular-nums">
                        {reputation}
                        <span className="text-base-content/60"> / 100</span>
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full border-2 border-ink bg-base-300">
                      <div
                        className={`h-full ${TYPE_FILL_CLASS[type]}`}
                        style={{ width: `${Math.min(100, reputation)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};
