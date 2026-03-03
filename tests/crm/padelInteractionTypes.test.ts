import { describe, expect, it } from "vitest";
import {
  CRM_PADEL_INTERACTION_TYPE_VALUES,
  CRM_PADEL_JOURNEY_TRIGGER_VALUES,
  isCrmPadelInteractionTypeToken,
  isCrmPadelJourneyTriggerToken,
} from "@/lib/crm/padelInteractionTypes";

describe("padel interaction type guards", () => {
  it("aceita apenas interações canónicas padel", () => {
    expect(isCrmPadelInteractionTypeToken("PADEL_MATCH_PLAYED")).toBe(true);
    expect(isCrmPadelInteractionTypeToken("BOOKING_CONFIRMED")).toBe(false);
    expect(CRM_PADEL_INTERACTION_TYPE_VALUES).toContain("PADEL_BOOKING_CONFIRMED");
  });

  it("aceita apenas triggers de journeys padel", () => {
    expect(isCrmPadelJourneyTriggerToken("PADEL_BOOKING_NO_SHOW")).toBe(true);
    expect(isCrmPadelJourneyTriggerToken("STORE_ORDER_PAID")).toBe(false);
    expect(CRM_PADEL_JOURNEY_TRIGGER_VALUES).not.toContain("STORE_ORDER_PAID");
  });
});
