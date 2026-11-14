import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

import type { TutorialStepId } from "@/data/utils/tutorial";

// ── Premiers pas ─────────────────────────────────────────────────────────────
// Le tutoriel d'une partie : affiché ou non, replié ou non, et les étapes déjà
// faites. Il ne démarre qu'avec une nouvelle partie (`startTutorial`) ; une
// partie d'avant le tutoriel le garde éteint (migration de sauvegarde).
export interface TutorialState {
  active: boolean;
  collapsed: boolean;
  completed: TutorialStepId[];
  /**
   * La scène d'arrivée a-t-elle été lue ? `false` seulement au lancement d'une
   * nouvelle partie ; absent (tutoriel d'avant l'histoire) vaut « lue ».
   */
  introSeen?: boolean;
}

export const INACTIVE_TUTORIAL: TutorialState = {
  active: false,
  collapsed: false,
  completed: [],
  introSeen: true,
};

export const tutorialSlice = createSlice({
  name: "tutorial",
  initialState: INACTIVE_TUTORIAL,
  reducers: {
    /** Nouvelle partie : tout est à faire. */
    startTutorial() {
      return { active: true, collapsed: false, completed: [], introSeen: false };
    },
    /** Scène d'arrivée lue : place à la première étape. */
    seeTutorialIntro(state) {
      state.introSeen = true;
    },
    /** Rouvert depuis le menu : on relit, sans rien perdre. */
    showTutorial(state) {
      state.active = true;
      state.collapsed = false;
    },
    hideTutorial(state) {
      state.active = false;
    },
    setTutorialCollapsed(state, action: PayloadAction<boolean>) {
      state.collapsed = action.payload;
    },
    completeTutorialStep(state, action: PayloadAction<TutorialStepId>) {
      if (!state.completed.includes(action.payload)) {
        state.completed.push(action.payload);
      }
    },
  },
});

export const {
  startTutorial,
  seeTutorialIntro,
  showTutorial,
  hideTutorial,
  setTutorialCollapsed,
  completeTutorialStep,
} = tutorialSlice.actions;

export default tutorialSlice.reducer;
