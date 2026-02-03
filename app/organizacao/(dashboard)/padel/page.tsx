import { redirect } from "next/navigation";
import { appendOrganizationIdToRedirectHref } from "@/lib/organizationId";

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const PADEL_CLUB_SECTION = "padel-club";
const PADEL_TOURNAMENTS_SECTION = "padel-tournaments";

const readSearchParam = (params: Props["searchParams"], key: string) => {
  const value = params?.[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value[0]) return value[0];
  return null;
};

export default async function OrganizationPadelRedirect({ searchParams }: Props) {
  const params = new URLSearchParams();
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (key === "tab" || key === "section") return;
      if (typeof value === "string") params.set(key, value);
      if (Array.isArray(value) && value[0]) params.set(key, value[0]);
    });
  }
  const explicitSection = readSearchParam(searchParams, "section");
  const explicitTool = readSearchParam(searchParams, "tool");
  const section =
    explicitSection === PADEL_TOURNAMENTS_SECTION || explicitTool === "tournaments"
      ? PADEL_TOURNAMENTS_SECTION
      : explicitSection === PADEL_CLUB_SECTION || explicitTool === "club"
        ? PADEL_CLUB_SECTION
        : params.get("eventId")
          ? PADEL_TOURNAMENTS_SECTION
          : PADEL_CLUB_SECTION;
  if (!params.get("padel")) {
    params.set("padel", section === PADEL_TOURNAMENTS_SECTION ? "calendar" : "clubs");
  }
  params.set("section", section);
  const target = await appendOrganizationIdToRedirectHref(
    `/organizacao/torneios?${params.toString()}`,
    searchParams,
  );
  redirect(target);
}
