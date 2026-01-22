import { redirect } from "next/navigation";

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function OrganizationPromoRedirect({ searchParams }: Props) {
  const params = new URLSearchParams();
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (key === "tab" || key === "section" || key === "marketing") return;
      if (typeof value === "string") params.set(key, value);
      if (Array.isArray(value) && value[0]) params.set(key, value[0]);
    });
  }
  params.set("tab", "promote");
  params.set("section", "marketing");
  params.set("marketing", "promos");
  redirect(`/organizacao?${params.toString()}`);
}
