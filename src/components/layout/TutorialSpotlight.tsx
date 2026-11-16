import { CSSProperties, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Compass, Xmark } from "iconoir-react";

import { useAppDispatch, useAppSelector } from "@/data/redux/hooks";
import type { RootState } from "@/data/redux/store";
import {
  completeTutorialStep,
  hideTutorial,
  seeTutorialIntro,
  setTutorialCollapsed,
} from "@/data/redux/tutorialSlice";
import {
  TUTORIAL_INTRO,
  TUTORIAL_NARRATOR,
  TUTORIAL_OUTRO,
  TUTORIAL_STEPS,
  TutorialStepId,
  currentTutorialStep,
  isTutorialFinished,
  isTutorialStepDone,
  tutorialGuide,
  upcomingTutorialMilestones,
} from "@/data/utils/tutorial";
import { formatPrice } from "@/data/utils";

/** Marge autour de l'élément éclairé, et écart entre lui et la bulle. */
const PAD = 6;
const GAP = 12;
const BUBBLE_W = 320;
const EDGE = 12;
/** Le guidage suit l'interface qui bouge (pages, listes, défilement). */
const TRACK_MS = 250;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Coche les étapes à mesure que la partie avance. Sélecteur unique : la liste
 * des étapes faites à cet instant, comparée champ à champ pour ne pas relancer
 * l'effet à chaque tick.
 */
const useDoneSteps = (pathname: string): TutorialStepId[] =>
  useAppSelector(
    (state: RootState) =>
      TUTORIAL_STEPS.filter((s) =>
        isTutorialStepDone(s.id, state, pathname),
      ).map((s) => s.id),
    (a, b) => a.length === b.length && a.every((id, i) => id === b[i]),
  );

const sameBox = (a: Box | null, b: Box | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height);

/**
 * Position à l'écran de l'élément repéré par `data-tuto`, suivie tant qu'elle
 * change (`null` s'il n'est pas affiché). Amené dans la vue une fois, à son
 * apparition.
 */
const useTargetBox = (target: string | null): Box | null => {
  const [box, setBox] = useState<Box | null>(null);
  const scrolled = useRef<string | null>(null);

  useEffect(() => {
    if (!target) {
      setBox(null);
      return;
    }
    const measure = () => {
      const el = document.querySelector<HTMLElement>(`[data-tuto="${target}"]`);
      const rect = el?.getBoundingClientRect();
      const next =
        el && rect && rect.width > 0 && rect.height > 0
          ? {
              top: Math.round(rect.top),
              left: Math.round(rect.left),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            }
          : null;
      if (el && next && scrolled.current !== target) {
        scrolled.current = target;
        // Caché sous le HUD (56 px) ou sous le dock (80 px), zones sûres
        // non comprises.
        const offscreen =
          rect!.top < 56 || rect!.bottom > window.innerHeight - 80;
        if (offscreen) el.scrollIntoView({ block: "center" });
      }
      setBox((prev) => (sameBox(prev, next) ? prev : next));
    };
    measure();
    const timer = window.setInterval(measure, TRACK_MS);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [target]);

  return box;
};

/** Une fenêtre modale du jeu est ouverte : elle passe devant le guidage. */
const useDialogOpen = (): boolean => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => setOpen(!!document.querySelector("dialog[open]"));
    check();
    const timer = window.setInterval(check, TRACK_MS);
    return () => window.clearInterval(timer);
  }, []);
  return open;
};

/** Une réplique d'Henri, le narrateur. */
const NarratorLine = ({ line }: { line: string }) => (
  <figure className="my-2.5 border-l-[3px] border-sun pl-3">
    <blockquote className="font-display text-[0.95rem] leading-snug">
      «&nbsp;{line}&nbsp;»
    </blockquote>
    <figcaption className="mt-0.5 text-xs font-bold text-base-content/60">
      — {TUTORIAL_NARRATOR}
    </figcaption>
  </figure>
);

/** Voile du guidage : l'encre du jeu, comme celui des modales. */
const VEIL = "color-mix(in oklab, var(--color-ink) 55%, transparent)";

/** Bulle sous l'élément, ou au-dessus s'il est dans la moitié basse. */
const bubbleStyle = (box: Box): CSSProperties => {
  const left = Math.min(
    Math.max(box.left + box.width / 2 - BUBBLE_W / 2, EDGE),
    window.innerWidth - BUBBLE_W - EDGE,
  );
  const below = box.top + box.height / 2 < window.innerHeight / 2;
  return below
    ? { left, top: box.top + box.height + PAD + GAP }
    : { left, bottom: window.innerHeight - box.top + PAD + GAP };
};

/**
 * Premiers pas, en surbrillance : l'écran s'assombrit sauf l'élément sur
 * lequel agir, et une bulle explique le geste. Rien n'est bloqué — le voile
 * laisse passer les clics. Le guidage s'efface devant les fenêtres du jeu
 * (fiche employé, décisions, pause) et reprend ensuite.
 */
export const TutorialSpotlight = () => {
  const dispatch = useAppDispatch();
  const { pathname } = useLocation();
  const { active, collapsed, completed, introSeen } = useAppSelector(
    (s) => s.tutorial,
  );
  // Absent (tutoriel d'avant l'histoire) : la scène d'arrivée est passée.
  const inIntro = introSeen === false;
  const paused = useAppSelector(
    (s) =>
      s.engine.gameOver ||
      !!s.engine.pendingRescue ||
      !!s.events.pending ||
      s.engine.gameSpeed === 0,
  );
  const done = useDoneSteps(pathname);
  const money = useAppSelector((s) => s.company.money);
  const candidates = useAppSelector((s) => s.employe.candidateList.length);
  const dialogOpen = useDialogOpen();

  useEffect(() => {
    if (!active) return;
    for (const id of done) {
      if (!completed.includes(id)) dispatch(completeTutorialStep(id));
    }
  }, [active, done, completed, dispatch]);

  const step = currentTutorialStep(completed, { money });
  // Rien à proposer pour l'instant (le premier produit attend quelques
  // contrats) : le tutoriel se tait et reviendra.
  const waiting = !step && !isTutorialFinished(completed);
  const guide = step ? tutorialGuide(step.id, pathname, { candidates }) : null;
  const shown = active && !collapsed && !paused && !dialogOpen && !inIntro;
  const box = useTargetBox(shown && guide ? guide.target : null);

  if (!active || paused || dialogOpen) return null;
  // En attente d'un seuil : les prochaines étapes et ce qui manque pour y
  // arriver, à la place de la bulle.
  if (waiting && !inIntro) {
    const milestones = upcomingTutorialMilestones(completed);
    return (
      <div
        aria-label="Prochaines étapes du tutoriel"
        className="toy-frame fixed bottom-[calc(var(--dock-h)+1rem)] left-3 z-30 w-72 max-w-[calc(100vw-1.5rem)] p-3"
      >
        <div className="flex items-center gap-2">
          <Compass width={16} height={16} className="text-base-content" />
          <p className="font-display text-base font-semibold">
            Prochaines étapes
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square ml-auto"
            aria-label="Passer le tutoriel"
            onClick={() => dispatch(hideTutorial())}
          >
            <Xmark width={14} height={14} />
          </button>
        </div>
        <ol className="mt-2 flex list-none flex-col gap-2 p-0">
          {milestones.map(({ step: next, money: target }, i) => (
            <li key={next.id}>
              <div
                className={
                  "flex items-baseline justify-between gap-2 text-sm " +
                  (i === 0 ? "font-bold" : "font-semibold opacity-60")
                }
              >
                <span>{next.title}</span>
                <span className="shrink-0 text-xs font-extrabold tabular-nums">
                  {i === 0
                    ? `${formatPrice(Math.max(0, money))} / ${formatPrice(target)} €`
                    : `${formatPrice(target)} €`}
                </span>
              </div>
              {i === 0 && (
                <progress
                  className="progress mt-1.5 h-2 w-full"
                  value={Math.max(0, Math.min(money, target))}
                  max={target}
                />
              )}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const position = TUTORIAL_STEPS.findIndex((s) => s.id === step?.id) + 1;
  const total = TUTORIAL_STEPS.length;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => dispatch(setTutorialCollapsed(false))}
        className="btn btn-sm fixed bottom-[calc(var(--dock-h)+1rem)] left-3 z-30 gap-2"
      >
        <Compass width={16} height={16} className="text-base-content" />
        Reprendre le tutoriel
        {step && (
          <span className="tabular-nums opacity-60">
            {position}/{total}
          </span>
        )}
      </button>
    );
  }

  // Scène d'arrivée : l'oncle Henri ouvre le garage, au centre de l'écran.
  if (inIntro) {
    return (
      <>
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[45]"
          style={{ backgroundColor: VEIL }}
        />
        <div
          role="dialog"
          aria-label="Début de l'histoire"
          className="toy-frame fixed top-1/2 left-1/2 z-[46] w-96 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 p-5"
        >
          <p className="text-xs font-extrabold text-base-content/60">
            {TUTORIAL_INTRO.date}
          </p>
          <NarratorLine line={TUTORIAL_INTRO.line} />
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm underline underline-offset-4"
              onClick={() => dispatch(hideTutorial())}
            >
              Passer le tutoriel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => dispatch(seeTutorialIntro())}
            >
              C'est parti
            </button>
          </div>
        </div>
      </>
    );
  }

  // Tout est fait : le dernier mot d'Henri.
  if (!step || !guide) {
    return (
      <div
        role="dialog"
        aria-label="Tutoriel terminé"
        className="toy-frame fixed bottom-[calc(var(--dock-h)+1rem)] left-1/2 z-[46] w-80 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 p-4"
      >
        <NarratorLine line={TUTORIAL_OUTRO} />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => dispatch(hideTutorial())}
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  const bubble = (
    <div
      role="dialog"
      aria-label={`Tutoriel, étape ${position} sur ${total}`}
      className={
        "toy-frame fixed z-[46] max-w-[calc(100vw-1.5rem)] p-4 " +
        (box ? "" : "bottom-[calc(var(--dock-h)+1rem)] left-3")
      }
      style={{ width: BUBBLE_W, ...(box ? bubbleStyle(box) : {}) }}
    >
      <div className="flex items-center gap-2">
        <span className="font-display text-lg leading-tight font-bold">
          {step.title}
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-base-300 px-2 py-0.5 text-xs font-extrabold tabular-nums">
          {position}/{total}
        </span>
      </div>
      <NarratorLine line={step.line} />
      <p className="text-sm leading-snug font-semibold text-base-content/80">
        {guide.text}
      </p>
      <div className="mt-3 flex items-center gap-1">
        {guide.shortcut && (
          <Link
            to={guide.shortcut.to}
            className="btn btn-primary btn-xs gap-1 no-underline"
          >
            {guide.shortcut.label}
            <ArrowRight width={14} height={14} />
          </Link>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-xs ml-auto"
          onClick={() => dispatch(setTutorialCollapsed(true))}
        >
          Réduire
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={() => dispatch(hideTutorial())}
        >
          Passer
        </button>
      </div>
    </div>
  );

  return (
    <>
      {box && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[45]">
          {/* Le voile : une ombre immense autour d'une découpe à la taille
              de l'élément. Les clics le traversent. */}
          <div
            className="absolute rounded-xl outline-[3px] outline-sun"
            style={{
              top: box.top - PAD,
              left: box.left - PAD,
              width: box.width + 2 * PAD,
              height: box.height + 2 * PAD,
              outlineStyle: "solid",
              boxShadow: `0 0 0 9999px ${VEIL}`,
            }}
          />
        </div>
      )}
      {bubble}
    </>
  );
};
