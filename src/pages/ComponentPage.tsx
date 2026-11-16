import { ReactElement, useMemo, useState } from "react";
import { Lock, WarningTriangle } from "iconoir-react";

import {
  COMPONENT_KINDS,
  COMPONENT_TYPE_ORDER,
  ComponentKind,
  ComponentKindId,
  ComponentTier,
  ComponentType,
  ProductionPerson,
  Recipe,
  TIER_GATE,
} from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import { useTopMenu } from "@/data/hooks/useTopMenu";
import { productTopMenuItems } from "@/pages/product/menu";
import { isProductionPerson } from "@/data/utils/production";
import {
  countKinds,
  craftBlocker,
  isKindAvailable,
  kindLabel,
  kindTechnologies,
  missingTechnology,
  netDeficits,
  recipeToRequirements,
} from "@/data/utils/recipes";
import { gateShift } from "@/data/utils/traits";
import { demandOf } from "@/data/utils/component";
import { COMPONENT_ICON, KindPill } from "@/components/component";
import { EmployeAvatar } from "@/components/employe/EmployeAvatar";
import { CodexLink } from "@/components/codex/CodexLink";
import { SectionTabs } from "@/components/layout/SectionTabs";

// ─────────────────────────────────────────────────────────────────────────────
// L'atelier : une ligne par famille, une colonne par niveau. Chaque tuile donne
// le stock d'une pièce, ce que les postes en ont réservé, qui la fabrique, et
// signale ce qui manque aux contrats et produits en cours. Une pièce pas encore
// inventée, ou que personne ne sait faire, est hachurée.
// ─────────────────────────────────────────────────────────────────────────────

const TIERS: ComponentTier[] = [1, 2, 3, 4];

const FAMILY_TEXT: Record<ComponentType, string> = {
  [ComponentType.CODE]: "text-code",
  [ComponentType.VISUEL]: "text-visuel",
  [ComponentType.UX]: "text-ux",
};

interface TileProps {
  kind: ComponentKind;
  stock: number;
  reserved: number;
  deficit: number;
  workers: ProductionPerson[];
  invented: boolean;
  skilled: boolean;
  selected: boolean;
  time: number;
  onSelect: () => void;
}

const Tile = ({
  kind,
  stock,
  reserved,
  deficit,
  workers,
  invented,
  skilled,
  selected,
  time,
  onSelect,
}: TileProps): ReactElement => {
  const locked = !invented || !skilled;
  const tech = missingTechnology(kind.id, time);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={
        "relative flex w-full flex-col gap-1 rounded-xl border-2 border-ink px-2.5 py-2 text-left transition-transform hover:-translate-y-px " +
        (selected ? "bg-primary " : locked ? "" : "bg-white ") +
        (deficit > 0 && !selected ? "ring-2 ring-error ring-inset" : "")
      }
      style={
        locked && !selected
          ? {
              background:
                "repeating-linear-gradient(135deg, var(--color-base-200) 0 8px, var(--color-base-100) 8px 16px)",
            }
          : undefined
      }
    >
      <span className="flex items-center justify-between gap-1">
        <KindPill kind={kind.id} size={20} />
        {deficit > 0 ? (
          <span className="rounded-full border-2 border-ink bg-error/15 px-1.5 text-[10px] font-extrabold">
            manque {deficit}
          </span>
        ) : !invented ? (
          <span className="inline-flex items-center gap-0.5 rounded-full border-2 border-ink bg-white px-1.5 text-[10px] font-extrabold">
            <Lock width={10} height={10} strokeWidth={2.6} />
            {tech?.year}
          </span>
        ) : !skilled ? (
          <span className="rounded-full border-2 border-ink bg-warning/15 px-1.5 text-[10px] font-extrabold">
            {kind.family} {TIER_GATE[kind.tier]}
          </span>
        ) : null}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="font-display text-2xl leading-none font-bold tabular-nums">
          {invented ? stock : "—"}
        </span>
        {reserved > 0 && (
          <span className="text-[11px] font-bold text-base-content/60 tabular-nums">
            +{reserved} réservé{reserved > 1 ? "s" : ""}
          </span>
        )}
      </span>
      <span className="text-[13px] leading-tight font-extrabold">
        {kind.label}
      </span>
      <span className="flex min-h-5 items-center justify-between gap-1 text-[11px] font-bold text-base-content/60">
        <span>
          {!invented
            ? "Pas encore inventé"
            : !skilled
              ? "Personne au seuil"
              : workers.length > 0
                ? `${workers.length} poste${workers.length > 1 ? "s" : ""}`
                : "Aucun poste"}
        </span>
        <span className="flex -space-x-1.5">
          {workers.slice(0, 4).map((w) => (
            <EmployeAvatar key={w.id} employe={w} size={20} />
          ))}
        </span>
      </span>
    </button>
  );
};

const KindDetail = ({
  kind,
  producers,
  time,
}: {
  kind: ComponentKind;
  producers: ProductionPerson[];
  time: number;
}): ReactElement => {
  const users = COMPONENT_KINDS.filter((k) => k.recipe[kind.id]);
  const skilled = producers.filter(
    (e) => craftBlocker(e, kind.id, time, gateShift(e)) === null,
  );
  const techs = kindTechnologies(kind.id);
  return (
    <aside className="toy-tile flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <KindPill kind={kind.id} size={34} />
        <div>
          <h2 className="font-display text-xl leading-tight font-semibold">
            {kind.label}
          </h2>
          <p className="text-xs font-bold text-base-content/60">
            {kind.family} · niveau {kind.tier}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="font-bold text-base-content/60">Recette</dt>
        <dd className="flex flex-wrap gap-1">
          {kind.tier === 1
            ? "travail brut"
            : recipeToRequirements(kind.recipe).map((r) => (
                <span
                  key={r.kind}
                  className="inline-flex items-center gap-1 rounded-full bg-base-200 py-0.5 pr-2 pl-0.5 text-xs font-extrabold"
                >
                  <KindPill kind={r.kind} size={16} />
                  {r.quantity} {kindLabel(r.kind)}
                </span>
              ))}
        </dd>
        <dt className="font-bold text-base-content/60">Seuil</dt>
        <dd>
          {kind.tier === 1 ? "aucun" : `${kind.family} ${TIER_GATE[kind.tier]}`}
        </dd>
        <dt className="font-bold text-base-content/60">Technologie</dt>
        <dd>
          {techs.length === 0
            ? "aucune"
            : techs.map((t) => `${t.name} (${t.year})`).join(", ")}
        </dd>
        <dt className="font-bold text-base-content/60">Utilisé par</dt>
        <dd>
          {users.length === 0
            ? "contrats et produits"
            : users.map((u) => u.label).join(", ")}
        </dd>
        <dt className="font-bold text-base-content/60">Savent le faire</dt>
        <dd>
          {skilled.length === 0
            ? "personne"
            : skilled.map((e) => `${e.firstName} ${e.lastName}`).join(", ")}
        </dd>
      </dl>
    </aside>
  );
};

export const ComponentPage: React.FC = (): ReactElement => {
  useTopMenu(productTopMenuItems);
  const stock = useAppSelector((state) => state.component.stock);
  const jobs = useAppSelector((state) => state.component.productionJobs);
  const employeList = useAppSelector((state) => state.employe.employeList);
  const day = useAppSelector((state) => Math.floor(state.engine.time / 24));
  // Besoins : contrats signés et produits en développement.
  const taskList = useAppSelector((state) => state.task.taskList);
  const products = useAppSelector((state) => state.product.products);
  const [selected, setSelected] = useState<ComponentKindId>("code");
  const time = day * 24;

  const producers = useMemo(
    () => employeList.filter(isProductionPerson),
    [employeList],
  );
  const counts = useMemo(() => countKinds(stock), [stock]);
  const reserved = useMemo(() => {
    const out: Recipe = {};
    for (const job of Object.values(jobs ?? {})) {
      for (const c of job.reserved) out[c.kind] = (out[c.kind] ?? 0) + 1;
    }
    return out;
  }, [jobs]);
  const deficits = useMemo(() => {
    const supply: Recipe = { ...counts };
    for (const job of Object.values(jobs ?? {})) {
      supply[job.kind] = (supply[job.kind] ?? 0) + 1;
    }
    return netDeficits(demandOf(taskList, products), supply);
  }, [counts, jobs, taskList, products]);
  const workersByKind = useMemo(() => {
    const out: Partial<Record<ComponentKindId, ProductionPerson[]>> = {};
    for (const e of producers) {
      const job = jobs?.[e.id];
      if (!job) continue;
      (out[job.kind] ??= []).push(e);
    }
    return out;
  }, [producers, jobs]);

  // Goulot : la pièce manquante du plus haut niveau, sans personne dessus.
  const bottleneck = useMemo(() => {
    const short = COMPONENT_KINDS.filter((k) => (deficits[k.id] ?? 0) > 0).sort(
      (a, b) =>
        b.tier - a.tier || (deficits[b.id] ?? 0) - (deficits[a.id] ?? 0),
    );
    return short.find((k) => !workersByKind[k.id]?.length) ?? short[0] ?? null;
  }, [deficits, workersByKind]);

  const selectedKind =
    COMPONENT_KINDS.find((k) => k.id === selected) ?? COMPONENT_KINDS[0];

  return (
    <div className="page-shell">
      <SectionTabs items={productTopMenuItems} ariaLabel="Section Production" />
      <div className="toy-frame page-frame space-y-4">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
          Atelier <CodexLink id="composants" />
        </h1>

        {bottleneck && (
          <div className="flex items-start gap-3 rounded-xl border-2 border-ink bg-warning/15 px-4 py-2.5 text-sm">
            <WarningTriangle
              width={18}
              height={18}
              className="mt-0.5 shrink-0"
            />
            <p>
              <span className="font-display font-semibold">
                Goulot : {bottleneck.label}.
              </span>{" "}
              Il en manque {deficits[bottleneck.id]} pour vos contrats et
              produits en cours
              {workersByKind[bottleneck.id]?.length
                ? `, ${workersByKind[bottleneck.id]!.length} poste${workersByKind[bottleneck.id]!.length > 1 ? "s" : ""} dessus.`
                : ", et personne n'en fabrique."}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="overflow-x-auto">
            <div className="grid min-w-[44rem] grid-cols-[6.5rem_repeat(4,minmax(0,1fr))] gap-2">
              <span />
              {TIERS.map((t) => (
                <span
                  key={t}
                  className="text-center text-xs font-extrabold text-base-content/60"
                >
                  Niveau {t}
                  {t > 1 && ` · stat ${TIER_GATE[t]}`}
                </span>
              ))}
              {COMPONENT_TYPE_ORDER.map((family) => {
                const Icon = COMPONENT_ICON[family];
                return [
                  <span
                    key={`${family}_head`}
                    className={`flex items-center gap-1.5 font-display text-lg font-bold ${FAMILY_TEXT[family]}`}
                  >
                    <Icon width={18} height={18} strokeWidth={2.2} />
                    {family}
                  </span>,
                  ...TIERS.map((tier) => (
                    <div
                      key={`${family}_${tier}`}
                      className="flex flex-col gap-2"
                    >
                      {COMPONENT_KINDS.filter(
                        (k) => k.family === family && k.tier === tier,
                      ).map((k) => (
                        <Tile
                          key={k.id}
                          kind={k}
                          stock={counts[k.id] ?? 0}
                          reserved={reserved[k.id] ?? 0}
                          deficit={deficits[k.id] ?? 0}
                          workers={workersByKind[k.id] ?? []}
                          invented={isKindAvailable(k.id, time)}
                          skilled={producers.some(
                            (e) =>
                              craftBlocker(e, k.id, time, gateShift(e)) ===
                              null,
                          )}
                          selected={k.id === selected}
                          time={time}
                          onSelect={() => setSelected(k.id)}
                        />
                      ))}
                    </div>
                  )),
                ];
              })}
            </div>
          </div>
          <KindDetail kind={selectedKind} producers={producers} time={time} />
        </div>
      </div>
    </div>
  );
};
