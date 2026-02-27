import { describe, expect, it } from "vitest";
import {
  listTelemetryCatalog,
  normalizeTelemetryEventNameToCatalog,
  resolveTelemetryContract,
  validateTelemetryContractPayload,
} from "@/domain/telemetry/catalog";

describe("telemetry catalog", () => {
  it("normaliza alias legado para nome canónico", () => {
    const normalized = normalizeTelemetryEventNameToCatalog("checkout_started");
    expect(normalized).toBe("checkout.flow.started");

    const contract = resolveTelemetryContract("checkout_started");
    expect(contract?.eventName).toBe("checkout.flow.started");
    expect(contract?.eventVersion).toBe("1.0.0");
  });

  it("rejeita nome inválido fora do padrão canónico", () => {
    const normalized = normalizeTelemetryEventNameToCatalog("Invalid Name");
    expect(normalized).toBeNull();
  });

  it("valida payload por schema e detecta evento desconhecido", () => {
    const valid = validateTelemetryContractPayload("auth_success_email", { mode: "signup" });
    expect(valid.ok).toBe(true);

    const unknown = validateTelemetryContractPayload("unknown.event", { ok: true });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) {
      expect(unknown.error).toBe("UNKNOWN_EVENT_CONTRACT");
    }
  });

  it("expõe catálogo serializável sem schema interno", () => {
    const catalog = listTelemetryCatalog();
    expect(catalog.length).toBeGreaterThan(10);
    expect(catalog[0]).toHaveProperty("eventName");
    expect(catalog[0]).toHaveProperty("eventVersion");
    expect(catalog[0]).toHaveProperty("aliases");
    expect((catalog[0] as Record<string, unknown>).payloadSchema).toBeUndefined();
  });
});
