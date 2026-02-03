import { redirect } from "next/navigation";
import { appendOrganizationIdToRedirectHref } from "@/lib/organizationId";

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function OrganizationPadelTournamentsPage({ searchParams }: Props) {
  const params = new URLSearchParams();
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (key === "tab" || key === "section" || key === "tool") return;
      if (typeof value === "string") params.set(key, value);
      if (Array.isArray(value) && value[0]) params.set(key, value[0]);
    });
  }
  if (!params.get("padel")) {
    params.set("padel", "calendar");
  }
  params.set("section", "padel-tournaments");
  const target = await appendOrganizationIdToRedirectHref(
    `/organizacao/torneios?${params.toString()}`,
    searchParams,
  );
  redirect(target);
}
