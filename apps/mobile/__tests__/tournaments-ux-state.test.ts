import { resolveRegistrationBlockReason } from "../features/tournaments/uxState";

describe("tournaments uxState", () => {
  it("bloqueia quando falta categoria", () => {
    const reason = resolveRegistrationBlockReason({
      registrationOpen: true,
      hasCategory: false,
      hasCategoryTicket: false,
      hasCategoryPurchasableTicket: false,
      joinMode: "LOOKING_FOR_PARTNER",
      inviteContact: "",
      pairingBusy: false,
      padelActionsDisabled: false,
    });
    expect(reason).toBe("MISSING_CATEGORY");
  });

  it("bloqueia quando categoria nao tem ticket ligado", () => {
    const reason = resolveRegistrationBlockReason({
      registrationOpen: true,
      hasCategory: true,
      hasCategoryTicket: false,
      hasCategoryPurchasableTicket: false,
      joinMode: "LOOKING_FOR_PARTNER",
      inviteContact: "",
      pairingBusy: false,
      padelActionsDisabled: false,
    });
    expect(reason).toBe("MISSING_CATEGORY_TICKET");
  });

  it("bloqueia quando ticket da categoria nao esta vendavel", () => {
    const reason = resolveRegistrationBlockReason({
      registrationOpen: true,
      hasCategory: true,
      hasCategoryTicket: true,
      hasCategoryPurchasableTicket: false,
      joinMode: "LOOKING_FOR_PARTNER",
      inviteContact: "",
      pairingBusy: false,
      padelActionsDisabled: false,
    });
    expect(reason).toBe("CATEGORY_TICKET_UNAVAILABLE");
  });

  it("deixa seguir quando estado esta pronto", () => {
    const reason = resolveRegistrationBlockReason({
      registrationOpen: true,
      hasCategory: true,
      hasCategoryTicket: true,
      hasCategoryPurchasableTicket: true,
      joinMode: "LOOKING_FOR_PARTNER",
      inviteContact: "",
      pairingBusy: false,
      padelActionsDisabled: false,
    });
    expect(reason).toBeNull();
  });
});
