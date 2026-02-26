import { describe, expect, it } from "vitest";
import {
  resolveAllowedServiceCourtIds,
  resolveAllowedServiceProfessionalIds,
  resolveAllowedServiceResourceIds,
  resolveAllowedServiceScopeIds,
} from "@/lib/reservas/serviceScopes";

describe("service scope links", () => {
  it("retorna null quando não há links configurados", () => {
    expect(resolveAllowedServiceProfessionalIds([])).toBeNull();
    expect(resolveAllowedServiceResourceIds([])).toBeNull();
    expect(resolveAllowedServiceCourtIds([])).toBeNull();
  });

  it("filtra links inativos e remove duplicados", () => {
    const scopes = resolveAllowedServiceScopeIds({
      professionalLinks: [
        { professionalId: 1, professional: { isActive: true } },
        { professionalId: 1, professional: { isActive: true } },
        { professionalId: 2, professional: { isActive: false } },
      ],
      resourceLinks: [
        { resourceId: 10, resource: { isActive: true, courtId: 200 } },
        { resourceId: 10, resource: { isActive: true, courtId: 200 } },
        { resourceId: 11, resource: { isActive: false, courtId: 201 } },
      ],
    });

    expect(scopes.allowedProfessionalIds).toEqual([1]);
    expect(scopes.allowedResourceIds).toEqual([10]);
    expect(scopes.allowedCourtIds).toEqual([200]);
  });

  it("assume link ativo quando não há relação carregada", () => {
    const scopes = resolveAllowedServiceScopeIds({
      professionalLinks: [{ professionalId: 3 }],
      resourceLinks: [{ resourceId: 30, resource: { courtId: 303 } }],
    });

    expect(scopes.allowedProfessionalIds).toEqual([3]);
    expect(scopes.allowedResourceIds).toEqual([30]);
    expect(scopes.allowedCourtIds).toEqual([303]);
  });
});
