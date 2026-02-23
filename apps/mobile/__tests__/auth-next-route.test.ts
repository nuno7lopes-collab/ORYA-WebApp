import { resolveSafeNextRoute } from "../lib/authNextRoute";

describe("resolveSafeNextRoute", () => {
  it("aceita rota interna simples", () => {
    expect(resolveSafeNextRoute("/perfil")).toBe("/perfil");
  });

  it("aceita rota codificada e normaliza", () => {
    expect(resolveSafeNextRoute("%2Fcheckout%3Fstep%3D2")).toBe("/checkout?step=2");
  });

  it("normaliza rota agrupada de tabs para caminho canónico", () => {
    expect(resolveSafeNextRoute("/(tabs)/profile")).toBe("/profile");
  });

  it("normaliza /index para a rota interna do tab discover", () => {
    expect(resolveSafeNextRoute("/index")).toBe("/(tabs)/index");
  });

  it("rejeita url absoluta externa", () => {
    expect(resolveSafeNextRoute("https://malicioso.example/path")).toBeNull();
  });

  it("rejeita rota protocol-relative", () => {
    expect(resolveSafeNextRoute("//malicioso.example")).toBeNull();
  });

  it("rejeita valores sem slash inicial", () => {
    expect(resolveSafeNextRoute("auth/email")).toBeNull();
  });

  it("rejeita caracteres de controlo", () => {
    expect(resolveSafeNextRoute("/rota\ninvalida")).toBeNull();
  });

  it("rejeita rotas internas fora da allowlist", () => {
    expect(resolveSafeNextRoute("/service")).toBeNull();
    expect(resolveSafeNextRoute("/foo/bar")).toBeNull();
    expect(resolveSafeNextRoute("/auth")).toBeNull();
  });

  it("aceita rotas dinâmicas permitidas", () => {
    expect(resolveSafeNextRoute("/store/nuno/product/raquete-1")).toBe("/store/nuno/product/raquete-1");
    expect(resolveSafeNextRoute("/messages/thread_123")).toBe("/messages/thread_123");
  });

  it("usa o primeiro valor quando vem como array", () => {
    expect(resolveSafeNextRoute(["/mapa", "/perfil"])).toBe("/mapa");
  });

  it("rejeita valores vazios", () => {
    expect(resolveSafeNextRoute("   ")).toBeNull();
    expect(resolveSafeNextRoute(undefined)).toBeNull();
    expect(resolveSafeNextRoute(null)).toBeNull();
  });
});
