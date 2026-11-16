import { FC, useEffect, useRef, useState } from "react";

import { Person, jobLabel } from "@/data/interface";
import { useAppSelector } from "@/data/redux/hooks";
import { EmployeAvatar } from "@/components/employe/EmployeAvatar";
import { interviewDialogue } from "@/data/utils/interviewDialogue";
import { SENIORITY_LABEL } from "@/data/utils/recruitment";
import { FOUNDER_ID } from "@/data/utils/research";

/** Avance d'une bulle « … » sur la réplique qu'elle annonce (fraction). */
const TYPING_LEAD = 0.07;

/**
 * Heure de jeu « lissée » : le moteur avance d'une heure entière par tick ;
 * entre deux ticks, on interpole selon le temps réel écoulé pour que
 * l'horloge et la conversation défilent en continu.
 */
const useSmoothTime = (time: number, tickMs: number): number => {
  const tickStart = useRef(performance.now());
  const [now, setNow] = useState(() => performance.now());

  useEffect(() => {
    tickStart.current = performance.now();
  }, [time]);

  useEffect(() => {
    if (tickMs <= 0) return;
    let frame = requestAnimationFrame(function loop(t) {
      setNow(t);
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, [tickMs]);

  if (tickMs <= 0) return time;
  return time + Math.min(1, Math.max(0, (now - tickStart.current) / tickMs));
};

/** Horloge à aiguilles : la grande fait un tour par heure de jeu. */
const Clock: FC<{ time: number }> = ({ time }) => {
  const hand = (deg: number, length: number, width: number) => (
    <line
      x1="50"
      y1="50"
      x2="50"
      y2={50 - length}
      strokeWidth={width}
      strokeLinecap="round"
      className="stroke-current"
      transform={`rotate(${deg} 50 50)`}
    />
  );
  return (
    <svg viewBox="0 0 100 100" className="h-16 w-16 shrink-0" aria-hidden>
      <circle
        cx="50"
        cy="50"
        r="45"
        className="fill-white stroke-current"
        strokeWidth="6"
      />
      {Array.from({ length: 12 }, (_, i) => (
        <line
          key={i}
          x1="50"
          y1="11"
          x2="50"
          y2={i % 3 === 0 ? 19 : 15}
          strokeWidth={i % 3 === 0 ? 4 : 2}
          className="stroke-current opacity-60"
          transform={`rotate(${i * 30} 50 50)`}
        />
      ))}
      {hand((time % 12) * 30, 22, 7)}
      {hand((time % 1) * 360, 34, 4)}
      <circle cx="50" cy="50" r="4" className="fill-current" />
    </svg>
  );
};

const clockLabel = (time: number): string => {
  const hours = Math.floor(time) % 24;
  const minutes = Math.floor((time % 1) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const Bubble: FC<{
  speaker: Person | undefined;
  mine: boolean;
  children: React.ReactNode;
}> = ({ speaker, mine, children }) => (
  <div
    className={
      "chat transition-all duration-300 starting:translate-y-2 starting:opacity-0 " +
      (mine ? "chat-end" : "chat-start")
    }
  >
    {speaker && (
      <div className="chat-image">
        <EmployeAvatar employe={speaker} size={32} />
      </div>
    )}
    <div
      className={
        "chat-bubble text-sm font-semibold text-base-content " +
        (mine ? "bg-base-300" : "bg-white")
      }
    >
      {children}
    </div>
  </div>
);

/**
 * Entretien en cours : l'écran est bloqué le temps que l'horloge du jeu fasse
 * défiler les heures de l'entretien, au fil d'une conversation entre le
 * fondateur et le candidat. Sous les décisions, le prêt de sauvetage et le
 * menu de pause (z-50), qui restent accessibles par-dessus.
 */
export const InterviewOverlay: FC = () => {
  const interview = useAppSelector((s) => s.employe.interview);
  const candidate = useAppSelector((s) =>
    s.employe.candidateList.find(
      (c) => c.id === s.employe.interview?.candidateId,
    ),
  );
  const founder = useAppSelector((s) =>
    s.employe.employeList.find((e) => e.id === FOUNDER_ID),
  );
  const time = useAppSelector((s) => s.engine.time);
  const tickMs = useAppSelector((s) => s.engine.gameSpeed);
  const smooth = useSmoothTime(time, interview ? tickMs : 0);

  if (!interview) return null;

  const span = Math.max(1, interview.endAt - interview.startAt);
  const progress = Math.min(
    1,
    Math.max(0, (smooth - interview.startAt) / span),
  );
  const lines = candidate ? interviewDialogue(candidate) : [];
  const shown = lines.filter((l) => l.at <= progress);
  const next = lines.find((l) => l.at > progress);
  const typing = next && progress >= next.at - TYPING_LEAD ? next : null;
  const name = candidate
    ? `${candidate.firstName} ${candidate.lastName}`
    : "le candidat";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Entretien avec ${name}`}
      className="fixed inset-0 z-[44] flex items-center justify-center bg-ink/60 p-4"
    >
      <div className="toy-frame w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-[1.75rem] shadow-[0_8px_0_var(--color-ink)]">
        <header className="flex items-center gap-4 border-b-[3px] border-ink bg-white px-6 py-4">
          <Clock time={smooth} />
          <div className="min-w-0 flex-1 flex flex-col gap-1">
            <h2 className="font-display text-xl leading-tight font-bold">
              Entretien avec {name}
            </h2>
            {candidate && (
              <p className="text-sm font-bold text-base-content/70">
                {jobLabel(candidate)}
                {candidate.seniority &&
                  ` · ${SENIORITY_LABEL[candidate.seniority]}`}
              </p>
            )}
          </div>
          <p className="shrink-0 font-display text-3xl font-bold tabular-nums">
            {clockLabel(smooth)}
          </p>
        </header>

        <div className="flex flex-col gap-4 px-6 py-5">
          <div
            className="flex h-72 flex-col justify-end gap-1 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_3rem)]"
            aria-live="polite"
          >
            {shown.map((l, i) => (
              <Bubble
                key={i}
                mine={l.speaker === "founder"}
                speaker={l.speaker === "founder" ? founder : candidate}
              >
                {l.text}
              </Bubble>
            ))}
            {typing && (
              <Bubble
                mine={typing.speaker === "founder"}
                speaker={typing.speaker === "founder" ? founder : candidate}
              >
                <span className="loading loading-dots loading-xs" />
              </Bubble>
            )}
          </div>

          <progress
            className="progress h-2 w-full"
            value={progress}
            max={1}
            aria-label="Avancement de l'entretien"
          />
        </div>
      </div>
    </div>
  );
};
