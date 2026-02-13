import { describe, expect, it } from "vitest";
import {
  appendOrganizationIdToHref,
  buildOrgHref,
  buildOrgHubHref,
  parseOrgIdFromPathnameStrict,
} from "@/lib/organizationIdUtils";

describe("organization canonical href helpers", () => {
  it("buildOrgHref compoe o href canonico", () => {
    expect(buildOrgHref(50, "/overview")).toBe("/org/50/overview");
    expect(buildOrgHref(50, "/finance/invoices", { tab: "invoices" })).toBe("/org/50/finance/invoices?tab=invoices");
  });

  it("buildOrgHref cai para org-hub quando orgId invalido", () => {
    expect(buildOrgHref(Number.NaN, "/overview")).toBe("/org-hub/organizations");
    expect(buildOrgHref(0, "/overview")).toBe("/org-hub/organizations");
  });

  it("buildOrgHubHref compoe o hub", () => {
    expect(buildOrgHubHref("/organizations")).toBe("/org-hub/organizations");
    expect(buildOrgHubHref("/create", { source: "invite" })).toBe("/org-hub/create?source=invite");
  });

  it("parseOrgIdFromPathnameStrict so aceita /org/:orgId", () => {
    expect(parseOrgIdFromPathnameStrict("/org/77/overview")).toBe(77);
    expect(parseOrgIdFromPathnameStrict("/org/77")).toBe(77);
    expect(parseOrgIdFromPathnameStrict("/organizacao/overview")).toBeNull();
    expect(parseOrgIdFromPathnameStrict("/org-hub/organizations")).toBeNull();
  });

  it("appendOrganizationIdToHref normaliza legacy para canonico", () => {
    expect(appendOrganizationIdToHref("/organizacao/manage", 7)).toBe("/org/7/events");
    expect(appendOrganizationIdToHref("/organizacao/become", null)).toBe("/org-hub/create");
    expect(appendOrganizationIdToHref("/organizacao", null)).toBe("/org-hub/organizations");
    expect(appendOrganizationIdToHref("/org/7/overview?organizationId=7", 7)).toBe("/org/7/overview");
  });
});
