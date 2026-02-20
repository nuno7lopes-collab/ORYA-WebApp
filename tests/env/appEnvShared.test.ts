import { describe, expect, it } from "vitest";
import { resolveEnvFromHost } from "@/lib/appEnvShared";

describe("resolveEnvFromHost", () => {
  it("classifica hosts locais como ambiente de teste", () => {
    expect(resolveEnvFromHost("localhost:3000")).toBe("test");
    expect(resolveEnvFromHost("127.0.0.1")).toBe("test");
    expect(resolveEnvFromHost("192.168.1.98")).toBe("test");
    expect(resolveEnvFromHost("10.0.0.4")).toBe("test");
    expect(resolveEnvFromHost("172.20.14.2")).toBe("test");
  });

  it("mantém hosts públicos em produção", () => {
    expect(resolveEnvFromHost("orya.pt")).toBe("prod");
    expect(resolveEnvFromHost("api.orya.pt")).toBe("prod");
  });

  it("respeita prefixes dedicados de teste", () => {
    expect(resolveEnvFromHost("test.orya.pt")).toBe("test");
    expect(resolveEnvFromHost("staging.orya.pt")).toBe("test");
  });
});
