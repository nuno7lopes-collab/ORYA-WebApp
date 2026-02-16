import { resolveMobileLink } from "../lib/links";

describe("resolveMobileLink org routing", () => {
  it("maps canonical org chat deep links to native messages", () => {
    expect(resolveMobileLink("https://orya.pt/org/42/chat")).toEqual({
      kind: "native",
      path: "/messages",
    });
    expect(resolveMobileLink("https://orya.pt/org/42/chat?conversationId=abc")).toEqual({
      kind: "native",
      path: "/messages/abc",
    });
  });

  it("rejects legacy org chat links", () => {
    expect(resolveMobileLink("https://orya.pt/organizacao/chat?conversationId=xyz")).toEqual({
      kind: "none",
    });
  });

  it("blocks org dashboard links from opening in mobile", () => {
    expect(resolveMobileLink("https://orya.pt/organizacao/manage?organizationId=42", { allowWeb: true })).toEqual({
      kind: "none",
    });
    expect(resolveMobileLink("https://orya.pt/org/42/manage", { allowWeb: true })).toEqual({
      kind: "none",
    });
  });
});
