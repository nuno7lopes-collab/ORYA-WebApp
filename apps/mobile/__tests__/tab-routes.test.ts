import { resolveTabKeyFromPathname } from "../components/navigation/tabOrder";
import {
  TAB_PATHNAMES,
  TAB_ROUTE_SEGMENTS,
  isTabRouteSegment,
  normalizeTabGroupedPathname,
} from "../lib/tabRoutes";

describe("tabRoutes", () => {
  it("expõe os segmentos e caminhos canónicos finais", () => {
    expect(TAB_ROUTE_SEGMENTS).toEqual([
      "inicio",
      "competir",
      "reservas",
      "comunidade",
      "perfil",
    ]);
    expect(TAB_PATHNAMES).toEqual({
      inicio: "/inicio",
      competir: "/competir",
      reservas: "/reservas",
      comunidade: "/comunidade",
      perfil: "/perfil",
    });
  });

  it("normaliza rotas agrupadas de tabs", () => {
    expect(normalizeTabGroupedPathname("/(tabs)")).toBe("/inicio");
    expect(normalizeTabGroupedPathname("/(tabs)/inicio")).toBe("/inicio");
    expect(normalizeTabGroupedPathname("/(tabs)/competir")).toBe("/competir");
    expect(normalizeTabGroupedPathname("/(tabs)/reservas")).toBe("/reservas");
    expect(normalizeTabGroupedPathname("/(tabs)/comunidade")).toBe("/comunidade");
    expect(normalizeTabGroupedPathname("/(tabs)/perfil")).toBe("/perfil");
  });

  it("rejeita segmentos inválidos no grupo de tabs", () => {
    expect(normalizeTabGroupedPathname("/(tabs)/desconhecido")).toBeNull();
    expect(normalizeTabGroupedPathname("/(tabs)/messages")).toBeNull();
    expect(normalizeTabGroupedPathname("/(tabs)/profile")).toBeNull();
  });

  it("resolve tab key para rotas agrupadas e canónicas", () => {
    expect(resolveTabKeyFromPathname("/(tabs)/inicio?source=test")).toBe("inicio");
    expect(resolveTabKeyFromPathname("/competir")).toBe("competir");
    expect(resolveTabKeyFromPathname("/reservas")).toBe("reservas");
    expect(resolveTabKeyFromPathname("/perfil")).toBe("perfil");
    expect(resolveTabKeyFromPathname("/(tabs)/comunidade")).toBe("comunidade");
  });

  it("não confunde rotas fora dos tabs", () => {
    expect(resolveTabKeyFromPathname("/service/123")).toBeNull();
    expect(resolveTabKeyFromPathname("/foo")).toBeNull();
  });

  it("tipa corretamente os segmentos válidos", () => {
    expect(isTabRouteSegment("inicio")).toBe(true);
    expect(isTabRouteSegment("competir")).toBe(true);
    expect(isTabRouteSegment("foo")).toBe(false);
  });
});
