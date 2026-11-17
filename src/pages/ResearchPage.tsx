import {
  CSSProperties,
  Fragment,
  ReactElement,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AntennaSignal,
  Check,
  Clock,
  Coins,
  Community,
  GraduationCap,
  Lock,
  Page,
  QuestionMark,
  Reports,
  StatsUpSquare,
  Truck,
  Xmark,
} from "iconoir-react";

import { useTopMenu } from "@/data/hooks/useTopMenu";
import { useMediaQuery } from "@/data/hooks/useMediaQuery";
import { companyTopMenuItems } from "@/pages/company/menu";
import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import { ResearchInProgress, cancelResearch } from "@/data/redux/researchSlice";
import { selectFondateur } from "@/data/redux/selectors";
import { formatPrice } from "@/data/utils";
import { CodexLink } from "@/components/codex/CodexLink";
import { SectionTabs } from "@/components/layout/SectionTabs";
import {
  FOUNDER_SKILLS,
  FounderSkillDef,
  FounderSkillId,
  RESEARCH_BRANCHES,
  ResearchBlocker,
  ResearchBranchId,
  checkResearchStart,
  getFounderSkill,
  researchHoursLeft,
  researchProgress,
  skillTier,
  startFounderResearch,
} from "@/data/utils/research";

const formatDays = (hours: number): string => {
  const days = Math.ceil(hours / 24);
  return `${days} jour${days > 1 ? "s" : ""}`;
};

const TIER_LABEL = ["I", "II", "III", "IV", "V"];

const BRANCH_COLOR: Record<ResearchBranchId, string> = {
  atelier: "var(--color-branch-atelier)",
  gestion: "var(--color-branch-gestion)",
  marche: "var(--color-branch-marche)",
  equipe: "var(--color-branch-equipe)",
};

const SKILL_ICON: Record<FounderSkillId, typeof Truck> = {
  delivery_advisor: Truck,
  contract_estimate: Clock,
  management_control: StatsUpSquare,
  cash_forecast: Coins,
  market_study: Reports,
  tech_watch: AntennaSignal,
  cv_reading: Page,
  social_climate: Community,
};

/** Couleur de la branche, exposée en `--c` aux classes du nœud. */
const branchStyle = (branch: ResearchBranchId): CSSProperties =>
  ({ "--c": BRANCH_COLOR[branch] }) as CSSProperties;

/** Motif affiché sous le bouton « Former » quand il est grisé. */
const blockerReason = (
  def: FounderSkillDef,
  blocker: ResearchBlocker,
  money: number,
): string => {
  switch (blocker) {
    case "acquired":
      return "Déjà acquise.";
    case "in_progress":
      return "Une formation est déjà en cours : le fondateur n'en suit qu'une à la fois.";
    case "requires":
      return def.requires
        ? `Demande d'abord « ${getFounderSkill(def.requires).name} ».`
        : "Prérequis manquant.";
    case "money":
      return `Il manque ${formatPrice(def.cost - money)} €.`;
  }
};

/** Jauge d'avancement de la formation : hachures jaunes sur piste papier. */
const ProgressGauge = ({ value }: { value: number }) => (
  <div
    role="progressbar"
    aria-label="Avancement de la formation"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={value}
    className="h-4 overflow-hidden rounded-full border-[2.5px] border-ink bg-base-200"
  >
    <div
      className={
        "stripes h-full border-ink bg-sun " +
        (value > 0 && value < 100 ? "border-r-2" : "")
      }
      style={{ width: `${value}%` }}
    />
  </div>
);

type SkillStatus = "acquired" | "current" | "available" | "locked";

const STATUS_LABEL: Record<SkillStatus, string> = {
  acquired: "Acquise",
  current: "En cours",
  available: "Disponible",
  locked: "Verrouillée",
};

interface SkillView {
  def: FounderSkillDef;
  status: SkillStatus;
  tier: number;
  /** Premier motif qui empêche de démarrer, s'il y en a un. */
  blocker?: ResearchBlocker;
}

const computeStatus = (
  def: FounderSkillDef,
  acquired: FounderSkillId[],
  current: ResearchInProgress | null,
): SkillStatus =>
  acquired.includes(def.id)
    ? "acquired"
    : current?.skillId === def.id
      ? "current"
      : def.requires !== undefined && !acquired.includes(def.requires)
        ? "locked"
        : "available";

// ── Nœud de l'arbre ──────────────────────────────────────────────────────────

/** Pastille ronde : icône de la formation, cadenas, anneau d'avancement. */
const NodeBadge = ({
  view,
  progress,
  size,
}: {
  view: SkillView;
  progress: number;
  size: "md" | "lg";
}) => {
  const Icon = view.status === "locked" ? Lock : SKILL_ICON[view.def.id];
  const dim = size === "lg" ? "size-12" : "size-11";
  const iconSize = size === "lg" ? 24 : 22;
  if (view.status === "current") {
    return (
      <span
        className={`relative grid ${dim} shrink-0 place-items-center rounded-full border-[2.5px] border-ink`}
        style={{
          background: `conic-gradient(var(--color-sun) ${progress}%, #fff 0)`,
        }}
      >
        <span className="absolute inset-1 rounded-full border-2 border-ink bg-white" />
        <Icon
          width={iconSize - 4}
          height={iconSize - 4}
          strokeWidth={2.2}
          className="relative"
        />
      </span>
    );
  }
  return (
    <span
      className={
        `relative grid ${dim} shrink-0 place-items-center rounded-full border-[2.5px] ` +
        (view.status === "acquired"
          ? "border-ink bg-(--c) text-white"
          : view.status === "locked"
            ? "border-dashed border-ink/40 bg-base-300"
            : "border-ink bg-[color-mix(in_oklab,var(--c)_16%,white)]")
      }
    >
      <Icon width={iconSize} height={iconSize} strokeWidth={2.2} />
      {view.status === "acquired" && (
        <span className="absolute -right-1.5 -bottom-1 grid size-5 place-items-center rounded-full border-2 border-ink bg-success text-white">
          <Check width={12} height={12} strokeWidth={3} />
        </span>
      )}
    </span>
  );
};

const StatusChip = ({ status }: { status: SkillStatus }) => (
  <span
    className={
      "shrink-0 rounded-full px-2 py-px text-[10px] font-black tracking-wide uppercase " +
      (status === "available"
        ? "border-2 border-ink bg-sun"
        : status === "current"
          ? "bg-ink text-sun"
          : status === "acquired"
            ? "text-success"
            : "bg-base-300")
    }
  >
    {STATUS_LABEL[status]}
  </span>
);

const nodeFrame = (status: SkillStatus, selected: boolean): string =>
  "border-[2.5px] transition-[translate,box-shadow] duration-75 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-(--c) motion-reduce:transition-none " +
  (selected ? "outline-3 outline-offset-3 outline-(--c) " : "") +
  (status === "locked"
    ? "border-dashed border-ink/40 bg-base-200 text-base-content/70"
    : (status === "current" ? "bg-[#fff6d9] " : "bg-white ") +
      "border-ink shadow-[0_4px_0_var(--color-ink)] hover:-translate-y-px active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-ink)]");

interface SkillNodeProps {
  view: SkillView;
  progress: number;
  selected: boolean;
  onSelect: () => void;
  /** tree : tuile verticale de l'arbre ; row : ligne de la vue téléphone. */
  layout: "tree" | "row";
}

const SkillNode = ({
  view,
  progress,
  selected,
  onSelect,
  layout,
}: SkillNodeProps): ReactElement => {
  const { def, status } = view;
  const meta = (
    <span className="text-[11px] text-base-content/60 tabular-nums">
      {formatPrice(def.cost)} € · {Math.ceil(def.durationHours / 24)} j
    </span>
  );
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${def.name} — ${STATUS_LABEL[status]}`}
      onClick={onSelect}
      style={branchStyle(def.branch)}
      className={
        nodeFrame(status, selected) +
        (layout === "tree"
          ? " flex w-36 flex-col items-center gap-1.5 [&>*:last-child]:mt-auto rounded-2xl px-2.5 pt-2.5 pb-2 text-center"
          : " flex w-full flex-row items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left")
      }
    >
      <NodeBadge view={view} progress={progress} size="md" />
      {layout === "tree" ? (
        <>
          <span className="font-display text-sm leading-tight font-semibold">
            {def.name}
          </span>
          {meta}
          <StatusChip status={status} />
        </>
      ) : (
        <>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-display text-sm leading-tight font-semibold">
              {def.name}
            </span>
            {meta}
          </span>
          <StatusChip status={status} />
        </>
      )}
    </button>
  );
};

/** Emplacement libre en bas d'une branche : l'arbre est appelé à grandir. */
const UpcomingNode = ({ layout }: { layout: "tree" | "row" }) => (
  <span
    aria-hidden
    className={
      "flex items-center rounded-2xl border-[2.5px] border-dashed border-ink/25 text-ink/35 " +
      (layout === "tree"
        ? "w-36 flex-col justify-center gap-1.5 px-2.5 py-3"
        : "w-full flex-row gap-2.5 px-2.5 py-2")
    }
  >
    <span className="grid size-11 place-items-center rounded-full border-[2.5px] border-dashed border-ink/25">
      <QuestionMark width={20} height={20} strokeWidth={2.2} />
    </span>
    <span className="font-display text-sm font-semibold">À venir</span>
  </span>
);

type LinkState = "done" | "open" | "dim";

/** État du lien entre une formation et la suivante dans sa branche. */
const linkState = (parent: SkillStatus, child?: SkillStatus): LinkState =>
  parent !== "acquired" || !child
    ? "dim"
    : child === "available"
      ? "open"
      : "done";

/** Trait vertical entre deux paliers : encre, jaune cerclé d'encre, pointillés. */
const Connector = ({
  state,
  className = "",
}: {
  state: LinkState;
  className?: string;
}) => (
  <span
    aria-hidden
    className={
      "block " +
      className +
      (state === "done"
        ? " w-1 rounded-full bg-ink"
        : state === "open"
          ? " w-2 rounded-full border-2 border-ink bg-sun"
          : " w-1 bg-[repeating-linear-gradient(var(--color-base-content)_0_3px,transparent_3px_8px)] opacity-35")
    }
  />
);

// ── Fiche de détail ──────────────────────────────────────────────────────────

interface SkillDetailProps {
  view: SkillView;
  progress: number;
  hoursLeft: number;
  money: number;
  onStart: () => void;
}

const SkillDetail = ({
  view,
  progress,
  hoursLeft,
  money,
  onStart,
}: SkillDetailProps): ReactElement => {
  const { def, status, tier, blocker } = view;
  const branch = RESEARCH_BRANCHES.find((b) => b.id === def.branch)!;
  const chain: FounderSkillDef[] = [];
  for (
    let d: FounderSkillDef | undefined = def;
    d;
    d = d.requires && getFounderSkill(d.requires)
  )
    chain.unshift(d);

  return (
    <section
      aria-label={`Fiche : ${def.name}`}
      style={branchStyle(def.branch)}
      className="flex flex-col gap-3 rounded-[1.1rem] border-[2.5px] border-ink bg-white p-4"
    >
      <div className="flex items-center gap-3">
        <NodeBadge view={view} progress={progress} size="lg" />
        <div className="min-w-0">
          <p className="text-xs font-black tracking-wide text-(--c) uppercase">
            {branch.name} · Palier {TIER_LABEL[tier]}
          </p>
          <h2 className="font-display text-xl leading-snug font-semibold">
            {def.name}
          </h2>
        </div>
      </div>
      <p className="text-sm">{def.description}</p>
      <p className="border-t-[1.5px] border-dashed border-base-300 pt-2.5 text-sm">
        <span className="font-extrabold">Débloque : </span>
        {def.unlocks}
      </p>
      {chain.length > 1 && (
        <ol
          aria-label="Chaîne de prérequis"
          className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold"
        >
          {chain.map((d, i) => (
            <li key={d.id} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden>→</span>}
              <span
                className={
                  "rounded-full border-2 border-ink px-2 py-px " +
                  (d.id === def.id
                    ? "bg-sun"
                    : status === "locked" && d.id === def.requires
                      ? "bg-white"
                      : "bg-success text-white")
                }
              >
                {d.name}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-base-200 px-2.5 py-2">
          <p className="text-[11px] font-extrabold text-base-content/60">
            Coût
          </p>
          <p
            className={
              "font-display text-lg font-semibold tabular-nums " +
              (blocker === "money" ? "text-error" : "")
            }
          >
            {formatPrice(def.cost)} €
          </p>
        </div>
        <div className="rounded-xl bg-base-200 px-2.5 py-2">
          <p className="text-[11px] font-extrabold text-base-content/60">
            Durée
          </p>
          <p className="font-display text-lg font-semibold tabular-nums">
            {formatDays(def.durationHours)}
          </p>
        </div>
      </div>

      {status === "acquired" ? (
        <p className="flex items-center justify-center gap-1.5 text-sm font-extrabold text-success">
          <Check width={16} height={16} strokeWidth={2.8} /> Acquise : l'outil
          est actif.
        </p>
      ) : status === "current" ? (
        <div className="flex flex-col gap-1.5">
          <ProgressGauge value={progress} />
          <p className="text-center text-sm font-bold text-base-content/70 tabular-nums">
            {progress} % · encore {formatDays(hoursLeft)}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            className="btn btn-primary"
            disabled={blocker !== undefined}
            onClick={onStart}
          >
            <GraduationCap width={18} height={18} />
            Former
          </button>
          <p className="text-center text-xs font-bold text-base-content/70">
            {blocker
              ? blockerReason(def, blocker, money)
              : `Le fondateur ne produira pas pendant ${formatDays(def.durationHours)}.`}
          </p>
        </div>
      )}
    </section>
  );
};

// ── Page ─────────────────────────────────────────────────────────────────────

export const ResearchPage: React.FC = (): ReactElement => {
  useTopMenu(companyTopMenuItems);
  const dispatch = useAppDispatch();
  const wide = useMediaQuery("(min-width: 640px)");
  const sideDetail = useMediaQuery("(min-width: 1280px)");

  const fondateur = useAppSelector(selectFondateur);
  const money = useAppSelector((s) => s.company.money);
  const time = useAppSelector((s) => s.engine.time);
  const acquired = useAppSelector((s) => s.research.acquired);
  const current = useAppSelector((s) => s.research.current);

  const currentDef = current ? getFounderSkill(current.skillId) : null;
  const currentProgress = current
    ? Math.round(researchProgress(current, time) * 100)
    : 0;
  const hoursLeft = current ? researchHoursLeft(current, time) : 0;

  const views: SkillView[] = FOUNDER_SKILLS.map((def) => {
    const status = computeStatus(def, acquired, current);
    const check = checkResearchStart(def, acquired, current, money);
    // Verrouillée : le prérequis manquant prime sur « une formation en cours ».
    const blocker = status === "locked" ? "requires" : check.blocker;
    return { def, status, tier: skillTier(def), blocker };
  });
  const viewOf = (id: FounderSkillId) => views.find((v) => v.def.id === id)!;

  // Sélection par défaut : la formation en cours, sinon la première disponible.
  const [selectedId, setSelectedId] = useState<FounderSkillId>(
    () =>
      current?.skillId ??
      views.find((v) => v.status === "available")?.def.id ??
      FOUNDER_SKILLS[0].id,
  );
  const selected = viewOf(selectedId);

  // Sous l'arbre (écran étroit), la fiche peut être hors de vue : on l'amène.
  const detailRef = useRef<HTMLDivElement>(null);
  const userPicked = useRef(false);
  useEffect(() => {
    if (!userPicked.current || sideDetail) return;
    detailRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId, sideDetail]);
  const select = (id: FounderSkillId) => {
    userPicked.current = true;
    setSelectedId(id);
  };

  // Un palier de plus que le plus profond, pour les emplacements « À venir ».
  const tierCount = Math.max(...views.map((v) => v.tier)) + 2;
  const branches = RESEARCH_BRANCHES.map((b) => {
    const byTier: (SkillView | undefined)[] = Array.from(
      { length: tierCount },
      (_, t) => views.find((v) => v.def.branch === b.id && v.tier === t),
    );
    const depth = byTier.filter(Boolean).length;
    return { branch: b, byTier, depth };
  });

  const nodeProps = (v: SkillView) => ({
    view: v,
    progress: v.status === "current" ? currentProgress : 0,
    selected: v.def.id === selectedId,
    onSelect: () => select(v.def.id),
  });

  // Grille : colonne des paliers + une colonne par branche ; en lignes,
  // l'en-tête puis, pour chaque palier, la ligne des nœuds et celle des liens.
  const nodeRow = (t: number) => 2 + t * 2;
  const linkRow = (t: number) => 3 + t * 2;

  const tree = wide ? (
    <div className="overflow-x-auto pb-2">
      <div
        className="grid min-w-[42rem] gap-x-3"
        style={{
          gridTemplateColumns: "2rem repeat(4, minmax(9.5rem, 1fr))",
          gridTemplateRows: `auto repeat(${tierCount - 1}, auto 2rem) auto`,
        }}
      >
        {Array.from({ length: tierCount }, (_, t) => (
          <span
            key={`tier_${t}`}
            className="flex items-center justify-center border-r-2 border-dashed border-ink/15 text-[11px] font-black tracking-widest text-base-content/50 uppercase [writing-mode:vertical-rl] rotate-180"
            style={{ gridColumn: 1, gridRow: nodeRow(t) }}
          >
            Palier {TIER_LABEL[t]}
          </span>
        ))}
        {branches.map(({ branch, byTier, depth }, col) => (
          <Fragment key={branch.id}>
            <div
              className="flex flex-col items-center gap-0.5 pb-3 font-display font-semibold"
              style={{ gridColumn: col + 2, gridRow: 1 }}
            >
              <span
                className="size-3.5 rounded-full border-2 border-ink bg-(--c)"
                style={branchStyle(branch.id)}
              />
              {branch.name}
              <span className="font-sans text-[11px] font-extrabold text-base-content/60">
                {branch.hint}
              </span>
            </div>
            <div
              aria-hidden
              className="rounded-2xl bg-[color-mix(in_oklab,var(--c)_7%,transparent)]"
              style={{
                ...branchStyle(branch.id),
                gridColumn: col + 2,
                gridRow: `2 / span ${tierCount * 2 - 1}`,
              }}
            />
            {byTier.map((v, t) => {
              if (t > depth) return null;
              const parent = t > 0 ? byTier[t - 1] : undefined;
              return (
                <Fragment key={`${branch.id}_${t}`}>
                  {parent && (
                    <div
                      className="z-10 flex justify-center"
                      style={{ gridColumn: col + 2, gridRow: linkRow(t - 1) }}
                    >
                      <Connector
                        state={linkState(parent.status, v?.status)}
                        className="h-full"
                      />
                    </div>
                  )}
                  <div
                    className="z-10 flex items-stretch justify-center py-1.5"
                    style={{ gridColumn: col + 2, gridRow: nodeRow(t) }}
                  >
                    {v ? (
                      <SkillNode {...nodeProps(v)} layout="tree" />
                    ) : (
                      <UpcomingNode layout="tree" />
                    )}
                  </div>
                </Fragment>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-3">
      {branches.map(({ branch, byTier }) => {
        const chain = byTier.filter((v): v is SkillView => v !== undefined);
        return (
          <section
            key={branch.id}
            aria-label={`Branche ${branch.name}`}
            style={branchStyle(branch.id)}
            className="rounded-2xl bg-[color-mix(in_oklab,var(--c)_8%,transparent)] px-3 py-2.5"
          >
            <h2 className="mb-2 flex items-center gap-1.5 font-display font-semibold">
              <span className="size-3 rounded-full border-2 border-ink bg-(--c)" />
              {branch.name}
              <span className="font-sans text-xs font-extrabold text-base-content/60">
                · {branch.hint}
              </span>
            </h2>
            <div className="flex flex-col">
              {chain.map((v, i) => (
                <Fragment key={v.def.id}>
                  {i > 0 && (
                    <Connector
                      state={linkState(chain[i - 1].status, v.status)}
                      className="ml-[1.9rem] h-3.5"
                    />
                  )}
                  <SkillNode {...nodeProps(v)} layout="row" />
                </Fragment>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );

  return (
    <div className="page-shell">
      <SectionTabs items={companyTopMenuItems} ariaLabel="Section Entreprise" />
      <div className="toy-frame page-frame space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h1 className="font-display text-2xl font-bold">
              Recherche &amp; formation
            </h1>
            <p className="flex items-center gap-1.5 text-sm font-bold text-base-content/70">
              {fondateur
                ? `${fondateur.firstName} ${fondateur.lastName}, fondateur`
                : "Fondateur"}{" "}
              <CodexLink id="competences-fondateur" />
            </p>
          </div>
          <span className="rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-xs font-extrabold tabular-nums">
            {acquired.length} / {FOUNDER_SKILLS.length} acquise
            {acquired.length > 1 ? "s" : ""}
          </span>
        </div>

        {current && currentDef && (
          <section className="toy-tile flex flex-col gap-2.5 p-4">
            <div className="flex flex-row items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-[2.5px] border-ink bg-sun">
                  <GraduationCap width={16} height={16} strokeWidth={2.2} />
                </span>
                Formation en cours : {currentDef.name}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm text-error"
                onClick={() => dispatch(cancelResearch())}
                title="Abandonner : l'avancement est perdu, le coût n'est pas remboursé"
              >
                <Xmark width={16} height={16} />
                Abandonner
              </button>
            </div>
            <ProgressGauge value={currentProgress} />
            <p className="text-sm font-bold text-base-content/70 tabular-nums">
              Encore {formatDays(hoursLeft)}
            </p>
          </section>
        )}

        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
          {tree}
          <div ref={detailRef} className="scroll-mt-4 xl:sticky xl:top-4">
            <SkillDetail
              view={selected}
              progress={selected.status === "current" ? currentProgress : 0}
              hoursLeft={hoursLeft}
              money={money}
              onStart={() => dispatch(startFounderResearch(selected.def.id))}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
