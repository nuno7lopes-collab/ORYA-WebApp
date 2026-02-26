import { describe, expect, it } from "vitest";
import {
  COMMUNITY_ACCESS_MODE_OPTIONS,
  COMMUNITY_TALK_POLICY_OPTIONS,
  formatCommunityAccessModeLabel,
  formatCommunityTalkPolicyLabel,
} from "@/lib/messages/communityUi";

describe("communityUi helpers", () => {
  it("mantém labels canónicas dos modos de acesso", () => {
    expect(COMMUNITY_ACCESS_MODE_OPTIONS).toEqual([
      { value: "PUBLIC", label: "Pública" },
      { value: "FOLLOWERS", label: "Seguidores" },
      { value: "APPROVAL", label: "Por aprovação" },
      { value: "INVITE", label: "Só convite" },
    ]);
  });

  it("mantém labels canónicas da política de fala", () => {
    expect(COMMUNITY_TALK_POLICY_OPTIONS).toEqual([
      { value: "EVERYONE", label: "Todos falam" },
      { value: "TEAM_ONLY", label: "Só equipa fala" },
    ]);
  });

  it("normaliza e resolve labels de acesso", () => {
    expect(formatCommunityAccessModeLabel("public")).toBe("Pública");
    expect(formatCommunityAccessModeLabel(" followers ")).toBe("Seguidores");
    expect(formatCommunityAccessModeLabel("approval")).toBe("Por aprovação");
    expect(formatCommunityAccessModeLabel("invite")).toBe("Só convite");
  });

  it("devolve fallback previsivel para valores desconhecidos", () => {
    expect(formatCommunityAccessModeLabel("legacy_custom")).toBe("LEGACY_CUSTOM");
    expect(formatCommunityTalkPolicyLabel("owner_only")).toBe("OWNER_ONLY");
    expect(formatCommunityAccessModeLabel("")).toBe("Desconhecido");
    expect(formatCommunityTalkPolicyLabel(null)).toBe("Desconhecido");
  });
});
