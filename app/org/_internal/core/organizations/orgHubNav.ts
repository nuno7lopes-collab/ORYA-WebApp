import { buildOrgHubHref } from "@/lib/organizationIdUtils";

export type OrgHubNavKey = "organizations" | "groups" | "create";

export type OrgHubNavItem = {
  key: OrgHubNavKey;
  href: string;
  label: string;
};

export const ORG_HUB_NAV_ITEMS: OrgHubNavItem[] = [
  {
    key: "organizations",
    href: buildOrgHubHref("/organizations"),
    label: "Organizações",
  },
  {
    key: "groups",
    href: buildOrgHubHref("/groups"),
    label: "Grupos",
  },
  {
    key: "create",
    href: buildOrgHubHref("/create"),
    label: "Nova organização",
  },
];

export function resolveOrgHubNavKey(pathname: string | null | undefined): OrgHubNavKey {
  const normalizedPath = (pathname ?? "").toLowerCase();
  if (normalizedPath.startsWith("/org-hub/create")) return "create";
  if (normalizedPath.startsWith("/org-hub/groups")) return "groups";
  return "organizations";
}
