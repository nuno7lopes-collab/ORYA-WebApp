import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("chat-ws degraded mode sem redis", () => {
  it("não encerra processo quando REDIS_URL falta ou falha em produção", async () => {
    const file = path.join(process.cwd(), "scripts", "chat-ws-server.js");
    const content = await fs.readFile(file, "utf8");

    expect(content).toContain("REDIS_URL em falta em produção. A correr em modo degradado");
    expect(content).toContain("Redis indisponível em produção. A continuar em modo degradado.");
    expect(content).not.toContain("REDIS_URL em falta em produção.\");\n  process.exit(1);");
    expect(content).not.toContain("Redis indisponível em produção.\");\n      process.exit(1);");
  });
});
