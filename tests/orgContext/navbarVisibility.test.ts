import { describe, expect, it } from "vitest";
import { shouldHideUserNavbar } from "@/app/components/navbarVisibility";

describe("shouldHideUserNavbar", () => {
  it("nao trata rotas legacy removidas", () => {
    expect(shouldHideUserNavbar("/organizacao")).toBe(false);
    expect(shouldHideUserNavbar("/organizacao/overview")).toBe(false);
    expect(shouldHideUserNavbar("/organizacao/manage")).toBe(false);
  });

  it("esconde em rotas canonicas /org", () => {
    expect(shouldHideUserNavbar("/org")).toBe(true);
    expect(shouldHideUserNavbar("/org/50/overview")).toBe(true);
    expect(shouldHideUserNavbar("/org/50/operations")).toBe(true);
  });

  it("esconde no hub canonico /org-hub", () => {
    expect(shouldHideUserNavbar("/org-hub")).toBe(true);
    expect(shouldHideUserNavbar("/org-hub/organizations")).toBe(true);
  });

  it("esconde em landing", () => {
    expect(shouldHideUserNavbar("/landing")).toBe(true);
    expect(shouldHideUserNavbar("/landing/invite")).toBe(true);
  });

  it("nao esconde nas rotas de utilizador/publicas", () => {
    expect(shouldHideUserNavbar("/")).toBe(false);
    expect(shouldHideUserNavbar("/descobrir")).toBe(false);
    expect(shouldHideUserNavbar("/me")).toBe(false);
    expect(shouldHideUserNavbar("/eventos/abc")).toBe(false);
  });

  it("nao esconde quando pathname e null", () => {
    expect(shouldHideUserNavbar(null)).toBe(false);
  });
});
