import { resolveTabKeyFromPathname } from "../components/navigation/tabOrder";
import { TAB_PATHNAMES, isTabRouteSegment, normalizeTabGroupedPathname } from "../lib/tabRoutes";

describe("tabRoutes", () => {
  it("mantém /index no grupo de tabs para evitar ambiguidade com raiz", () => {
    expect(TAB_PATHNAMES.index).toBe("/(tabs)/index");
  });

  it("normaliza rotas agrupadas de tabs", () => {
    expect(normalizeTabGroupedPathname("/(tabs)")).toBe("/(tabs)/index");
    expect(normalizeTabGroupedPathname("/(tabs)/index")).toBe("/(tabs)/index");
    expect(normalizeTabGroupedPathname("/(tabs)/agora")).toBe("/agora");
  });

  it("rejeita segmentos inválidos no grupo de tabs", () => {
    expect(normalizeTabGroupedPathname("/(tabs)/desconhecido")).toBeNull();
  });

  it("resolve tab key para rotas agrupadas e canónicas", () => {
    expect(resolveTabKeyFromPathname("/(tabs)/index?source=test")).toBe("index");
    expect(resolveTabKeyFromPathname("/profile")).toBe("profile");
    expect(resolveTabKeyFromPathname("/(tabs)/messages")).toBe("messages");
  });

  it("não confunde rotas fora dos tabs", () => {
    expect(resolveTabKeyFromPathname("/service/123")).toBeNull();
    expect(resolveTabKeyFromPathname("/foo")).toBeNull();
  });

  it("tipa corretamente os segmentos válidos", () => {
    expect(isTabRouteSegment("agora")).toBe(true);
    expect(isTabRouteSegment("index")).toBe(true);
    expect(isTabRouteSegment("foo")).toBe(false);
  });
});
