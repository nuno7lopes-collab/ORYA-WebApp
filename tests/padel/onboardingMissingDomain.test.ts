import { describe, expect, it } from "vitest";
import { getPadelOnboardingMissing, isPadelOnboardingComplete } from "@/domain/padelOnboarding";

describe("domain/padelOnboarding", () => {
  it("não marca phone como obrigatório", () => {
    const missing = getPadelOnboardingMissing({
      profile: {
        fullName: "Jogador Teste",
        username: "jogador.pt",
        contactPhone: null,
        gender: "MALE",
        padelLevel: "3",
        padelPreferredSide: "ESQUERDA",
      },
      email: "jogador@orya.pt",
    });

    expect(missing).toEqual({});
    expect(isPadelOnboardingComplete(missing)).toBe(true);
  });

  it("mantém obrigatórios de identidade e competitivo", () => {
    const missing = getPadelOnboardingMissing({
      profile: {
        fullName: "",
        username: null,
        contactPhone: "+351912345678",
        gender: null,
        padelLevel: null,
        padelPreferredSide: null,
      },
      email: null,
    });

    expect(missing).toEqual({
      fullName: true,
      username: true,
      email: true,
      gender: true,
      level: true,
      preferredSide: true,
    });
    expect(isPadelOnboardingComplete(missing)).toBe(false);
  });
});
