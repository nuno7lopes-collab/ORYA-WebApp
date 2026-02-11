import { configDefaults, defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: [...configDefaults.exclude, "apps/mobile/__tests__/**", "apps/mobile/node_modules/**"],
  },
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "$1") },
      { find: /^@orya\/shared$/, replacement: path.resolve(__dirname, "packages/shared/src/index.ts") },
      { find: /^@orya\/shared\/(.*)$/, replacement: path.resolve(__dirname, "packages/shared/src/$1") },
      { find: "server-only", replacement: path.resolve(__dirname, "tests/server-only.ts") },
    ],
  },
});
