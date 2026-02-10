import { describe, expect, it } from "vitest";
import { normalizeUsernameInput, sanitizeUsername, validateUsername } from "../lib/username";

describe("mobile username rules", () => {
  it("sanitizes accents, spaces, and invalid chars", () => {
    expect(sanitizeUsername("João Silva")).toBe("joaosilva");
    expect(sanitizeUsername("  ORYA__User  ")).toBe("orya__user");
    expect(sanitizeUsername("a..b")).toBe("a.b");
    expect(sanitizeUsername(".start")).toBe("start");
    expect(sanitizeUsername("end.")).toBe("end");
  });

  it("validates length and allowed characters", () => {
    expect(validateUsername("ab").valid).toBe(false);
    expect(validateUsername("abc").valid).toBe(true);
    expect(validateUsername("a_b.c").valid).toBe(true);
    expect(validateUsername("a-b").valid).toBe(false);
  });

  it("normalizes dots and edges before validating", () => {
    expect(sanitizeUsername("a..b")).toBe("a.b");
    expect(validateUsername("a..b").valid).toBe(true);
    expect(sanitizeUsername(".abc")).toBe("abc");
    expect(validateUsername(".abc").valid).toBe(true);
    expect(sanitizeUsername("abc.")).toBe("abc");
    expect(validateUsername("abc.").valid).toBe(true);
  });

  it("enforces max length by trimming", () => {
    const trimmed = sanitizeUsername("a".repeat(16));
    expect(trimmed.length).toBe(15);
    expect(validateUsername("a".repeat(16)).valid).toBe(true);
    expect(validateUsername("a".repeat(15)).valid).toBe(true);
  });

  it("normalizes free-form input with @ prefix", () => {
    expect(normalizeUsernameInput(" @João.Silva ")).toBe("joao.silva");
    expect(normalizeUsernameInput("@__TEST__")).toBe("__test__");
  });
});
