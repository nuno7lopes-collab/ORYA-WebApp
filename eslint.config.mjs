import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const A11Y_P0_RULES = {
  "jsx-a11y/alt-text": "error",
  "jsx-a11y/aria-props": "error",
  "jsx-a11y/aria-proptypes": "error",
  "jsx-a11y/aria-unsupported-elements": "error",
  "jsx-a11y/role-has-required-aria-props": "error",
  "jsx-a11y/role-supports-aria-props": "error",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      ...A11Y_P0_RULES,
      // Desativamos regras ruidosas até concluirmos um cleanup completo do código existente.
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // Allow CommonJS-style imports in scripts and transitional modules.
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
  {
    // React Native / Expo (apps/mobile) doesn't map 1:1 to web a11y rules (e.g. alt on <Image />),
    // and some React compiler rules are too strict/noisy for RN animation patterns.
    files: ["apps/mobile/**/*.{ts,tsx,js,jsx}"],
    rules: {
      ...Object.fromEntries(Object.keys(A11Y_P0_RULES).map((key) => [key, "off"])),
      "react-hooks/refs": "off",
    },
  },
]);

export default eslintConfig;
