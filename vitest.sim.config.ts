import { defineConfig } from "vitest/config";
import * as path from "path";

// Simulation d'équilibre (`npm run sim`) : des parties entières jouées par un
// bot, hors de la suite de tests ordinaire. Voir `src/sim/balance.sim.ts`.
export default defineConfig({
  resolve: {
    alias: [{ find: "@", replacement: path.resolve("./src") }],
  },
  test: {
    include: ["src/sim/**/*.sim.ts"],
    environment: "node",
    testTimeout: 60 * 60 * 1000,
  },
});
