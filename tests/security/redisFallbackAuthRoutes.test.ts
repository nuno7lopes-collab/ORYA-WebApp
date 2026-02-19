import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLocal(pathname: string) {
  return readFileSync(resolve(process.cwd(), pathname), "utf8");
}

const AUTH_AND_USERNAME_ROUTES = [
  "app/api/auth/login/route.ts",
  "app/api/auth/send-otp/route.ts",
  "app/api/auth/password/reset-request/route.ts",
  "app/api/username/check/route.ts",
  "app/api/profiles/check-username/route.ts",
];

describe("redis fallback nas rotas auth/username", () => {
  it("não devolve 503 por indisponibilidade de backend de rate limit", () => {
    for (const routeFile of AUTH_AND_USERNAME_ROUTES) {
      const source = readLocal(routeFile);
      expect(source).not.toContain("RATE_LIMIT_BACKEND_UNAVAILABLE");
      expect(source).not.toContain("status: 503");
      expect(source).not.toContain("RATE_LIMIT_SERVICE_UNAVAILABLE");
    }
  });
});
