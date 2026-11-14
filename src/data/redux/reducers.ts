// Les slices du jeu, sans persistance ni boucle de jeu : le store du navigateur
// (`store.ts`) les enveloppe de redux-persist, la simulation hors navigateur
// (`sim/`) les monte telles quelles.
import engineReducer from "@/data/redux/engineSlice";
import companyReducer from "@/data/redux/companySlice";
import employeReducer from "@/data/redux/employeSlice";
import taskReducer from "@/data/redux/taskSlice";
import componentReducer from "@/data/redux/componentSlice";
import notificationReducer from "@/data/redux/notificationSlice";
import productReducer from "@/data/redux/productSlice";
import eventsReducer from "@/data/redux/eventsSlice";
import loanReducer from "@/data/redux/loanSlice";
import financeReducer from "@/data/redux/financeSlice";
import studioReducer from "@/data/redux/studioSlice";
import researchReducer from "@/data/redux/researchSlice";
import competitorReducer from "@/data/redux/competitorSlice";
import saveReducer from "@/data/redux/saveSlice";
import tutorialReducer from "@/data/redux/tutorialSlice";

export const gameReducers = {
  engine: engineReducer,
  company: companyReducer,
  employe: employeReducer,
  task: taskReducer,
  component: componentReducer,
  notification: notificationReducer,
  product: productReducer,
  events: eventsReducer,
  loan: loanReducer,
  finance: financeReducer,
  studio: studioReducer,
  // Compétences du fondateur (recherche / formation). Slice absent des saves
  // antérieures : redux-persist le remonte sur son état initial, pas de purge.
  research: researchReducer,
  // Studios concurrents (le marché). Slice absent des saves antérieures : il
  // remonte vide et la boucle de jeu le peuple au premier tick (`buildRoster`).
  competitor: competitorReducer,
  // Vue de l'écran de sauvegarde (non persistée — reconstruite via `listSaves`).
  save: saveReducer,
  // Premiers pas : propres à chaque partie, donc sauvegardés avec elle.
  tutorial: tutorialReducer,
};
