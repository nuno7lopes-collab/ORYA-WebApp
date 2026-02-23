import { describe, expect, it } from "vitest";
import { campaignChannelsToList, hasAnyCampaignChannel, normalizeCampaignChannels } from "@/lib/crm/campaignChannels";

describe("crm campaign channels", () => {
  it("não faz fallback para IN_APP quando o input é inválido", () => {
    const channels = normalizeCampaignChannels(null);
    expect(channels).toEqual({ inApp: false, email: false });
    expect(hasAnyCampaignChannel(channels)).toBe(false);
  });

  it("normaliza aliases legados de IN_APP", () => {
    const channels = normalizeCampaignChannels(["in-app", "email"]);
    expect(channels).toEqual({ inApp: true, email: true });
    expect(campaignChannelsToList(channels)).toEqual(["IN_APP", "EMAIL"]);
  });

  it("aceita payload em object com flags booleanas", () => {
    const channels = normalizeCampaignChannels({ inApp: true, email: false });
    expect(channels).toEqual({ inApp: true, email: false });
    expect(hasAnyCampaignChannel(channels)).toBe(true);
  });
});
