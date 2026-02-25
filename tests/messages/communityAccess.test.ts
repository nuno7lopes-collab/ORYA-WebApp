import { describe, expect, it } from "vitest";
import {
  buildInviteExpiryFromPreset,
  parseCommunityAccessMode,
  parseCommunityTalkPolicy,
  parseInvitePreset,
  resolveCommunityReadOnlyReason,
} from "@/lib/messages/communityAccess";

describe("communityAccess helpers", () => {
  it("parseCommunityTalkPolicy aceita valores validos", () => {
    expect(parseCommunityTalkPolicy("everyone")).toBe("EVERYONE");
    expect(parseCommunityTalkPolicy("TEAM_ONLY")).toBe("TEAM_ONLY");
  });

  it("parseCommunityTalkPolicy rejeita valores invalidos", () => {
    expect(parseCommunityTalkPolicy("invalid")).toBeNull();
    expect(parseCommunityTalkPolicy(null)).toBeNull();
  });

  it("parseCommunityAccessMode aceita os quatro modos", () => {
    expect(parseCommunityAccessMode("public")).toBe("PUBLIC");
    expect(parseCommunityAccessMode("followers")).toBe("FOLLOWERS");
    expect(parseCommunityAccessMode("approval")).toBe("APPROVAL");
    expect(parseCommunityAccessMode("invite")).toBe("INVITE");
  });

  it("parseInvitePreset suporta sem validade e presets validos", () => {
    expect(parseInvitePreset("")).toEqual({ ok: true, ms: null });
    expect(parseInvitePreset(null)).toEqual({ ok: true, ms: null });

    const tenMinutes = parseInvitePreset("10m");
    expect(tenMinutes.ok).toBe(true);
    if (!tenMinutes.ok) return;
    expect(tenMinutes.ms).toBe(10 * 60 * 1000);
  });

  it("parseInvitePreset rejeita presets invalidos", () => {
    expect(parseInvitePreset("9m")).toEqual({ ok: false, error: "INVALID_PRESET" });
  });

  it("buildInviteExpiryFromPreset devolve null sem preset", () => {
    expect(buildInviteExpiryFromPreset(null)).toBeNull();
  });

  it("buildInviteExpiryFromPreset cria data futura", () => {
    const now = Date.now();
    const expiry = buildInviteExpiryFromPreset(60_000);
    expect(expiry).not.toBeNull();
    expect((expiry as Date).getTime()).toBeGreaterThanOrEqual(now + 59_000);
  });

  it("resolveCommunityReadOnlyReason prioriza mute", () => {
    const reason = resolveCommunityReadOnlyReason({
      talkPolicy: "EVERYONE",
      accessMode: "PUBLIC",
      isTeamMember: false,
      isFollowing: true,
      followGraceEndsAt: null,
      writeMutedAt: new Date("2026-01-01T10:00:00.000Z"),
      writeMutedUntil: null,
      now: new Date("2026-01-01T10:05:00.000Z"),
    });

    expect(reason).toBe("COMMUNITY_WRITE_MUTED");
  });

  it("resolveCommunityReadOnlyReason bloqueia TEAM_ONLY para cliente", () => {
    const reason = resolveCommunityReadOnlyReason({
      talkPolicy: "TEAM_ONLY",
      accessMode: "PUBLIC",
      isTeamMember: false,
      isFollowing: true,
      followGraceEndsAt: null,
      writeMutedAt: null,
      writeMutedUntil: null,
      now: new Date("2026-01-01T10:05:00.000Z"),
    });

    expect(reason).toBe("COMMUNITY_TEAM_ONLY");
  });

  it("resolveCommunityReadOnlyReason exige follow quando grace expirou", () => {
    const reason = resolveCommunityReadOnlyReason({
      talkPolicy: "EVERYONE",
      accessMode: "FOLLOWERS",
      isTeamMember: false,
      isFollowing: false,
      followGraceEndsAt: new Date("2026-01-01T09:00:00.000Z"),
      writeMutedAt: null,
      writeMutedUntil: null,
      now: new Date("2026-01-01T10:05:00.000Z"),
    });

    expect(reason).toBe("FOLLOW_REQUIRED");
  });

  it("resolveCommunityReadOnlyReason permite escrita durante grace", () => {
    const reason = resolveCommunityReadOnlyReason({
      talkPolicy: "EVERYONE",
      accessMode: "FOLLOWERS",
      isTeamMember: false,
      isFollowing: false,
      followGraceEndsAt: new Date("2026-01-01T12:00:00.000Z"),
      writeMutedAt: null,
      writeMutedUntil: null,
      now: new Date("2026-01-01T10:05:00.000Z"),
    });

    expect(reason).toBeNull();
  });
});
