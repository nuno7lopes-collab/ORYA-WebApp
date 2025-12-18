import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      // Desativamos regras ruidosas até conseguirmos um cleanup completo do legado.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // Allow CommonJS-style imports in scripts and legacy modules.
      "@typescript-eslint/no-require-imports": "off",
      // React compiler-aware rules are noisy for existing code; surface as warnings instead of errors.
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/incompatible-library": "off",
      "eslint-comments/no-unused-disable": "off",
    },
  },
  {
    files: ["scripts/**/*.{js,ts}"],
    rules: {
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
