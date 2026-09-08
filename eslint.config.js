import js from "@eslint/js";
import globals from "globals";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

// ── Flat config ESLint 9 ─────────────────────────────────────────────────────
// Migration de l'ancien `.eslintrc.cjs` (déprécié et inopérant sous ESLint 9,
// qui exige un `eslint.config.js`). Mêmes ensembles de règles :
//   eslint:recommended + @typescript-eslint/recommended + react-hooks/recommended
//   + react-refresh/only-export-components (warn).

export default [
  { ignores: ["dist", "node_modules", "public", "scripts"] },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2020,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2020 },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // TypeScript résout déjà les identifiants : le `no-undef` du cœur ESLint
      // fait double emploi et casse sur le namespace `React` (JSX runtime auto).
      // Désactivation recommandée par typescript-eslint pour les fichiers typés.
      "no-undef": "off",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  // Fichiers de test : globals vitest (globals: true dans vite.config.ts).
  {
    files: ["**/*.{test,spec}.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
