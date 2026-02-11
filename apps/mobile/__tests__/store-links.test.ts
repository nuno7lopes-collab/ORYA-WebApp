import { resolveMobileLink } from "../lib/links";

describe("resolveMobileLink store mapping", () => {
  it("maps /:username/loja to native store root", () => {
    const result = resolveMobileLink("https://orya.pt/acme/loja");
    expect(result).toEqual({ kind: "native", path: "/store/acme" });
  });

  it("maps product/cart/checkout store deep links", () => {
    expect(resolveMobileLink("https://orya.pt/acme/loja/produto/camisola")).toEqual({
      kind: "native",
      path: "/store/acme/product/camisola",
    });
    expect(resolveMobileLink("https://orya.pt/acme/loja/carrinho")).toEqual({
      kind: "native",
      path: "/store/acme/cart",
    });
    expect(resolveMobileLink("https://orya.pt/acme/loja/checkout")).toEqual({
      kind: "native",
      path: "/store/acme/checkout",
    });
  });

  it("maps store purchases routes", () => {
    expect(resolveMobileLink("https://orya.pt/me/compras/loja")).toEqual({
      kind: "native",
      path: "/store/purchases",
    });
    expect(resolveMobileLink("https://orya.pt/me/compras/loja/123")).toEqual({
      kind: "native",
      path: "/store/purchases/123",
    });
  });
});
