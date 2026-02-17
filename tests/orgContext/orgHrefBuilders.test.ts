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

  it("appendOrganizationIdToHref preserva hrefs legacy fora do namespace /org", () => {
    expect(appendOrganizationIdToHref("/organizacao/manage", 7)).toBe("/organizacao/manage");
    expect(appendOrganizationIdToHref("/organizacao/become", null)).toBe("/organizacao/become");
    expect(appendOrganizationIdToHref("/organizacao", null)).toBe("/organizacao");
    expect(appendOrganizationIdToHref("/org/become?organizationId=7", 7)).toBe("/org/become?organizationId=7");
    expect(appendOrganizationIdToHref("/org/7/overview?organizationId=7", 7)).toBe("/org/7/overview");
  });

  it("appendOrganizationIdToHref canoniza /org e shorthand modular", () => {
    expect(appendOrganizationIdToHref("/org?organizationId=7", 7)).toBe("/org/7/overview");
    expect(appendOrganizationIdToHref("/org/overview?section=ferramentas&organizationId=7", 7)).toBe(
      "/org/7/overview?section=ferramentas",
    );
    expect(appendOrganizationIdToHref("/org/overview?organizationId=7&org=7", 7)).toBe("/org/7/overview");
    expect(appendOrganizationIdToHref("/org/staff", 7)).toBe("/org/7/staff");
    expect(appendOrganizationIdToHref("/org/analyze?section=ops", 7)).toBe("/org/7/analyze?section=ops");
    expect(appendOrganizationIdToHref("/org/padel/tournaments/create", 7)).toBe(
      "/org/7/padel/tournaments/create",
    );
    expect(appendOrganizationIdToHref("/org/events/new?preset=padel", 7)).toBe(
      "/org/7/events/new?preset=padel",
    );
  });
});
