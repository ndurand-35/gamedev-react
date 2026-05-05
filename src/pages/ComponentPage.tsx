import { ReactElement, useMemo } from "react";

import {
  Component,
  ComponentQuality,
  ComponentType,
  ProductionPerson,
  QUALITY_LABELS,
  QUALITY_TEXT_CLASS,
  qualityFromAverage,
} from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import { PRODUCTION_THRESHOLD } from "@/data/redux/componentSlice";
import { getRelevantStat } from "@/data/utils/component";
import { ComponentTypeBadge } from "@/components/component";

const ReputationByTypeCard = () => {
  const repByType = useAppSelector((s) => s.company.reputationByType);
  return (
    <div className="card bg-base-100 shadow-md border border-base-300">
      <div className="p-4 space-y-3">
        <h2 className="text-lg font-semibold">Réputation par domaine</h2>
        <div className="grid grid-cols-3 gap-4">
          {(Object.values(ComponentType) as ComponentType[]).map((t) => {
            const v = repByType[t] ?? 0;
            return (
              <div key={`rep_${t}`} className="space-y-1">
                <div className="flex flex-row items-center justify-between text-sm">
                  <ComponentTypeBadge type={t} size={16} />
                  <span className="tabular-nums font-semibold">{v}/100</span>
                </div>
                <progress
                  className="progress progress-primary w-full h-1.5"
                  value={v}
                  max={100}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const TYPE_ORDER: ComponentType[] = [
  ComponentType.CODE,
  ComponentType.VISUEL,
  ComponentType.UX,
];

const QUALITY_DOT_CLASS: Record<ComponentQuality, string> = {
  [ComponentQuality.BACLE]: "bg-error",
  [ComponentQuality.MEDIOCRE]: "bg-warning",
  [ComponentQuality.CORRECT]: "bg-base-content",
  [ComponentQuality.BON]: "bg-info",
  [ComponentQuality.TRES_BON]: "bg-success",
  [ComponentQuality.EXCELLENT]: "bg-accent",
};

const isProductionPerson = (p: any): p is ProductionPerson =>
  typeof p.frontStat === "number";

export const ComponentPage: React.FC = (): ReactElement => {
  const stock = useAppSelector((state) => state.component.stock);
  const employeList = useAppSelector((state) => state.employe.employeList);

  const grouped = useMemo(() => {
    const map: Record<ComponentType, Component[]> = {
      [ComponentType.CODE]: [],
      [ComponentType.VISUEL]: [],
      [ComponentType.UX]: [],
    };
    for (const c of stock) map[c.type].push(c);
    return map;
  }, [stock]);

  const qualityOrder: ComponentQuality[] = [
    ComponentQuality.EXCELLENT,
    ComponentQuality.TRES_BON,
    ComponentQuality.BON,
    ComponentQuality.CORRECT,
    ComponentQuality.MEDIOCRE,
    ComponentQuality.BACLE,
  ];

  const countByQuality = (list: Component[]): Record<ComponentQuality, number> => {
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
      map[type] += (getRelevantStat(e, type) * 24) / PRODUCTION_THRESHOLD;
    }
    return map;
  }, [employeList]);

  const averageQuality = (list: Component[]) => {
    if (list.length === 0) return 0;
    return list.reduce((acc, c) => acc + c.quality, 0) / list.length;
  };

  return (
    <div className="p-8 mt-14 mb-20 space-y-6">
      <h1 className="mb-4">Stock de composants</h1>

      <ReputationByTypeCard />

      <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4">
        {TYPE_ORDER.map((type) => {
          const list = grouped[type];
          const avg = averageQuality(list);
          const rate = productionPerDay[type];
          const counts = countByQuality(list);
          return (
            <div
              key={`stock_${type}`}
              className="card bg-base-100 shadow-md border border-base-300"
            >
              <div className="p-4 space-y-3">
                <div className="flex flex-row items-center justify-between">
                  <h2 className="card-title">
                    <ComponentTypeBadge type={type} size={20} />
                  </h2>
                  <span className="badge badge-neutral">
                    {list.length} en stock
                  </span>
                </div>
                <div className="flex flex-row space-x-4 text-sm opacity-75">
                  <span>Production : {rate.toFixed(1)} / jour</span>
                  <span className={QUALITY_TEXT_CLASS[qualityFromAverage(avg)]}>
                    Q moy. {QUALITY_LABELS[qualityFromAverage(avg)]}
                  </span>
                </div>
                <div className="flex flex-row items-end justify-between pt-1">
                  {qualityOrder.map((q) => (
                    <div
                      key={`stock_${type}_q_${q}`}
                      className="flex flex-col items-center gap-1 tooltip"
                      data-tip={QUALITY_LABELS[q]}
                    >
                      <span
                        className={`inline-block w-3 h-3 rounded-full ${QUALITY_DOT_CLASS[q]} ${
                          counts[q] === 0 ? "opacity-30" : ""
                        }`}
                      />
                      <span
                        className={`text-xs tabular-nums ${
                          counts[q] === 0 ? "opacity-40" : "font-semibold"
                        }`}
                      >
                        {counts[q]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
