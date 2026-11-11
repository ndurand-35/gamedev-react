import { describe, expect, it } from "vitest";

import reducer, {
  JOURNAL_MAX_ENTRIES,
  NotificationState,
  dismissNotification,
  hideToast,
  notificationStampMiddleware,
  pushNotification,
} from "@/data/redux/notificationSlice";

const empty: NotificationState = { list: [] };

describe("journal d'activité", () => {
  it("masquer un toast garde l'entrée au journal", () => {
    let state = reducer(empty, pushNotification({ message: "Paie versée" }));
    const id = state.list[0].id;
    state = reducer(state, hideToast(id));
    expect(state.list).toHaveLength(1);
    expect(state.list[0].toastDismissed).toBe(true);
  });

  it("seul l'effacement explicite retire une entrée", () => {
    let state = reducer(empty, pushNotification({ message: "A" }));
    state = reducer(state, dismissNotification(state.list[0].id));
    expect(state.list).toHaveLength(0);
  });

  it("borne le journal en gardant les entrées les plus récentes", () => {
    let state = empty;
    for (let i = 0; i < JOURNAL_MAX_ENTRIES + 5; i++) {
      state = reducer(state, pushNotification({ message: `m${i}` }));
    }
    expect(state.list).toHaveLength(JOURNAL_MAX_ENTRIES);
    expect(state.list[0].message).toBe("m5");
  });

  it("le middleware date l'entrée à l'heure de jeu courante", () => {
    const seen: unknown[] = [];
    const run = notificationStampMiddleware({
      getState: () => ({ engine: { time: 1234 } }),
      dispatch: (() => undefined) as never,
    })((action) => {
      seen.push(action);
      return action;
    });
    run(pushNotification({ message: "Contrat livré" }));
    run(pushNotification({ message: "Daté", gameTime: 7 }));
    expect((seen[0] as { payload: { gameTime: number } }).payload.gameTime).toBe(
      1234,
    );
    expect((seen[1] as { payload: { gameTime: number } }).payload.gameTime).toBe(
      7,
    );
  });
});
