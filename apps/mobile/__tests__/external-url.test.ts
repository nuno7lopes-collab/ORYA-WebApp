import { resolveSafeHttpUrl } from "../lib/externalUrl";

describe("resolveSafeHttpUrl", () => {
  it("aceita urls https", () => {
    expect(resolveSafeHttpUrl("https://orya.pt/fatura.pdf")).toBe(
      "https://orya.pt/fatura.pdf",
    );
  });

  it("aceita urls http", () => {
    expect(resolveSafeHttpUrl("http://localhost:3000/file")).toBe(
      "http://localhost:3000/file",
    );
  });

  it("rejeita esquemas não permitidos", () => {
    expect(resolveSafeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(resolveSafeHttpUrl("file:///tmp/test.pdf")).toBeNull();
    expect(resolveSafeHttpUrl("data:text/plain,hello")).toBeNull();
  });

  it("rejeita valores inválidos", () => {
    expect(resolveSafeHttpUrl("")).toBeNull();
    expect(resolveSafeHttpUrl("not a url")).toBeNull();
    expect(resolveSafeHttpUrl(undefined)).toBeNull();
    expect(resolveSafeHttpUrl(null)).toBeNull();
  });
});
