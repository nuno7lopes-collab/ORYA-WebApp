import { parseGenerateScheduleArgs } from "./padel_generate_autoschedule_top_paddel";

describe("padel_generate_autoschedule_top_paddel", () => {
  it("usa defaults seguros", () => {
    const parsed = parseGenerateScheduleArgs(["--run-tag", "seed-1"]);
    expect(parsed.orgUsername).toBe("top_padel");
    expect(parsed.generateExistingPolicy).toBe("skip");
    expect(parsed.executionMode).toBe("SYNC");
    expect(parsed.partialMode).toBe("ALLOW_PARTIAL");
    expect(parsed.strategy).toBe("BALANCED_BY_CATEGORY");
    expect(parsed.dryRun).toBe(false);
    expect(parsed.startFromNow).toBe(false);
    expect(parsed.bypassHardBlockGenerate).toBe(true);
  });

  it("aceita overrides válidos", () => {
    const parsed = parseGenerateScheduleArgs([
      "--org-username",
      "top_padel",
      "--run-tag",
      "seed-2",
      "--base-url",
      "http://localhost:33123/",
      "--generate-existing-policy",
      "replace",
      "--execution-mode",
      "async",
      "--partial-mode",
      "require_full",
      "--strategy",
      "groups_first",
      "--poll-timeout-ms",
      "120000",
      "--dry-run",
      "--start-from-now",
      "--no-hardblock-bypass",
    ]);
    expect(parsed.baseUrl).toBe("http://localhost:33123");
    expect(parsed.generateExistingPolicy).toBe("replace");
    expect(parsed.executionMode).toBe("ASYNC");
    expect(parsed.partialMode).toBe("REQUIRE_FULL");
    expect(parsed.strategy).toBe("GROUPS_FIRST");
    expect(parsed.pollTimeoutMs).toBe(120000);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.startFromNow).toBe(true);
    expect(parsed.bypassHardBlockGenerate).toBe(false);
  });

  it("rejeita policy inválida", () => {
    expect(() =>
      parseGenerateScheduleArgs(["--run-tag", "seed-3", "--generate-existing-policy", "force"]),
    ).toThrow("Invalid --generate-existing-policy");
  });

  it("exige run tag", () => {
    expect(() => parseGenerateScheduleArgs([])).toThrow("Missing --run-tag");
  });
});
