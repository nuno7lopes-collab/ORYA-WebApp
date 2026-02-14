import { describe, it } from "vitest";
import { execSync } from "node:child_process";

const STORE_DOMAIN_PATHS = [
  "app/api/org/[orgId]/store",
  "app/api/public/store",
  "app/api/me/purchases/store",
  "app/org/[orgId]/store",
  "app/[username]/loja",
  "components/store",
  "components/storefront",
  "lib/store",
  "lib/storeAccess.ts",
];

function runRg(command: string, shell = "/bin/zsh") {
  try {
    return execSync(command, { stdio: "pipe", shell }).toString().trim();
  } catch (error: any) {
    if (typeof error?.status === "number" && error.status === 1) {
      return "";
    }
    throw error;
  }
}

describe("store legacy guardrails", () => {
  it("blocks legacy API namespace usage across runtime", () => {
    const output = runRg('rg -n "/api/me/store|/api/org/1/loja|/api/store/" app components lib apps/mobile -S');

    if (output) {
      throw new Error(`Legacy API namespaces found:\n${output}`);
    }
  });

  it("blocks legacy ownership/visibility/shipping contract in store domain", () => {
    const targets = STORE_DOMAIN_PATHS.map((item) => `"${item}"`).join(" ");
    const output = runRg(
      `rg -n "StoreOwnerType|owner_type|StoreProductStatus|StoreBundleStatus|\\bshippingMode\\b|\\bisVisible\\b" ${targets} -S`,
    );

    if (output) {
      throw new Error(`Legacy contract tokens found in store domain:\n${output}`);
    }
  });

  it("blocks direct status flag checks in public storefront surfaces", () => {
    const output = runRg(
      'set -o noglob; rg -n "store\\.(status|showOnProfile|checkoutEnabled)" app/api/public/store app/[username]/loja components/storefront -S',
    );

    if (output) {
      throw new Error(`Direct store flag checks found outside storeAccess:\n${output}`);
    }
  });

  it("blocks legacy helper aliases in runtime", () => {
    const output = runRg('rg -n "\\bisStorePublic\\b|\\bcanCheckoutStore\\b" app components lib domain -S');

    if (output) {
      throw new Error(`Legacy store helper aliases found:\n${output}`);
    }
  });
});
