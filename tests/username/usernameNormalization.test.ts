import { describe, expect, it } from "vitest";
import { normalizeUsernameInput, validateUsername } from "@/lib/username";
import { isReservedUsername } from "@/lib/reservedUsernames";

describe("username normalization", () => {
  it("normalizes legacy hyphen usernames to underscore", () => {
    expect(normalizeUsernameInput("orya-org")).toBe("orya_org");
    expect(normalizeUsernameInput("@orya-org")).toBe("orya_org");
  });

  it("no longer reserves orya", () => {
    expect(isReservedUsername("orya")).toBe(false);
    expect(validateUsername("orya").valid).toBe(true);
  });
});
