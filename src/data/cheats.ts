import type { Store } from "@reduxjs/toolkit";

import { setMoney } from "@/data/redux/companySlice";

const MOTHERLOAD_AMOUNT = 50_000;

// Codes de triche tapés dans la console du navigateur. Exposés en getters sur
// `window` : taper `motherload` (sans parenthèses) suffit à les déclencher.
export function installCheats(store: Store) {
  Object.defineProperty(window, "motherload", {
    configurable: true,
    get() {
      const money = store.getState().company.money as number;
      store.dispatch(setMoney(money + MOTHERLOAD_AMOUNT));
      return `+${MOTHERLOAD_AMOUNT.toLocaleString("fr-FR")} € — trésorerie : ${(
        money + MOTHERLOAD_AMOUNT
      ).toLocaleString("fr-FR")} €`;
    },
  });
}
