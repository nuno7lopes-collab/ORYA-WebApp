import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const eventPath = resolve(process.cwd(), "app/event/[slug].tsx");

describe("event invite validation race contract", () => {
  it("protege validação de token de convite contra respostas stale", () => {
    const file = readFileSync(eventPath, "utf8");
    expect(file).toContain("const inviteTokenRequestIdRef = useRef(0)");
    expect(file).toContain("const requestId = inviteTokenRequestIdRef.current + 1");
    expect(file).toContain("inviteTokenRequestIdRef.current = requestId");
    expect(file).toContain("if (requestId !== inviteTokenRequestIdRef.current) return;");
  });

  it("protege validação de identificador de convite contra respostas stale", () => {
    const file = readFileSync(eventPath, "utf8");
    expect(file).toContain("const inviteIdentifierRequestIdRef = useRef(0)");
    expect(file).toContain("const requestId = inviteIdentifierRequestIdRef.current + 1");
    expect(file).toContain("inviteIdentifierRequestIdRef.current = requestId");
    expect(file).toContain("if (requestId !== inviteIdentifierRequestIdRef.current) return;");
  });
});
