import { describe, expect, it, vi } from "vitest";

import type { Person } from "@/data/interface";
import { setGameSpeed } from "@/data/redux/engineSlice";
import employeReducer, {
  beginInterview,
  endInterview,
  revealCandidate,
  type InterviewState,
} from "@/data/redux/employeSlice";
import type { RootState } from "@/data/redux/store";
import { GAME_SPEEDS } from "@/data/utils/constant";
import {
  INTERVIEW_TICK_MS,
  interviewBlocker,
  processInterviewTick,
  startInterview,
} from "@/data/utils/interview";
import { INTERVIEW_HOURS } from "@/data/utils/recruitment";

const candidate = (over: Partial<Person> = {}): Person =>
  ({
    id: 7,
    firstName: "Ada",
    lastName: "Martin",
    revealedStats: false,
    ...over,
  }) as Person;

const stateWith = ({
  interview = null,
  candidates = [candidate()],
  time = 100,
  gameSpeed = GAME_SPEEDS.X3,
  researching = false,
}: {
  interview?: InterviewState | null;
  candidates?: Person[];
  time?: number;
  gameSpeed?: number;
  researching?: boolean;
} = {}): RootState =>
  ({
    employe: { employeList: [], candidateList: candidates, interview },
    engine: { time, gameSpeed },
    research: { acquired: [], current: researching ? { id: "x" } : null },
  }) as unknown as RootState;

const actionsOf = (dispatch: ReturnType<typeof vi.fn>) =>
  dispatch.mock.calls.map(([a]) => a);

describe("startInterview", () => {
  it("occupe le fondateur, bloque l'écran et règle l'horloge sur la conversation", () => {
    const dispatch = vi.fn();
    const ok = startInterview(7)(dispatch as never, () => stateWith());
    expect(ok).toBe(true);
    expect(actionsOf(dispatch)).toEqual([
      beginInterview({
        candidateId: 7,
        startAt: 100,
        endAt: 100 + INTERVIEW_HOURS,
        speedBefore: GAME_SPEEDS.X3,
      }),
      setGameSpeed(INTERVIEW_TICK_MS),
    ]);
  });

  it("refuse un second entretien, un fondateur en formation ou un profil connu", () => {
    const running: InterviewState = {
      candidateId: 3,
      startAt: 0,
      endAt: 4,
      speedBefore: 0,
    };
    expect(interviewBlocker(stateWith({ interview: running }), 7)).toBe("busy");
    expect(interviewBlocker(stateWith({ researching: true }), 7)).toBe(
      "researching",
    );
    expect(
      interviewBlocker(
        stateWith({ candidates: [candidate({ revealedStats: true })] }),
        7,
      ),
    ).toBe("unknown");
    const dispatch = vi.fn();
    startInterview(7)(dispatch as never, () => stateWith({ interview: running }));
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("processInterviewTick", () => {
  const running = (speedBefore: number): InterviewState => ({
    candidateId: 7,
    startAt: 100,
    endAt: 104,
    speedBefore,
  });

  it("attend la fin de l'entretien", () => {
    const dispatch = vi.fn();
    processInterviewTick(
      dispatch as never,
      stateWith({ interview: running(0), time: 103 }),
    );
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("révèle le profil et rend la vitesse d'avant", () => {
    const dispatch = vi.fn();
    processInterviewTick(
      dispatch as never,
      stateWith({
        interview: running(GAME_SPEEDS.X3),
        time: 104,
        gameSpeed: INTERVIEW_TICK_MS,
      }),
    );
    const actions = actionsOf(dispatch);
    expect(actions).toContainEqual(endInterview());
    expect(actions).toContainEqual(revealCandidate(7));
    expect(actions).toContainEqual(setGameSpeed(GAME_SPEEDS.X3));
  });

  it("garde la vitesse choisie par le joueur pendant l'entretien", () => {
    const dispatch = vi.fn();
    processInterviewTick(
      dispatch as never,
      stateWith({
        interview: running(GAME_SPEEDS.X3),
        time: 104,
        gameSpeed: GAME_SPEEDS.X2,
      }),
    );
    expect(
      actionsOf(dispatch).some((a) => a.type === setGameSpeed.type),
    ).toBe(false);
  });

  it("se clôt sans révéler si le candidat est parti entre-temps", () => {
    const dispatch = vi.fn();
    processInterviewTick(
      dispatch as never,
      stateWith({ interview: running(0), time: 104, candidates: [] }),
    );
    const actions = actionsOf(dispatch);
    expect(actions).toContainEqual(endInterview());
    expect(actions.some((a) => a.type === revealCandidate.type)).toBe(false);
  });
});

describe("employeSlice — entretien", () => {
  it("pose puis efface l'entretien en cours", () => {
    const base = employeReducer(undefined, { type: "init" });
    const started = employeReducer(base, beginInterview(running()));
    expect(started.interview?.candidateId).toBe(7);
    expect(employeReducer(started, endInterview()).interview).toBeNull();
  });
});

function running(): InterviewState {
  return { candidateId: 7, startAt: 0, endAt: 4, speedBefore: 0 };
}
