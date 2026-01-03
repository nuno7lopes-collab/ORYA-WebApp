import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const toQuery = (searchParams?: PageProps["searchParams"]) => {
  const params = new URLSearchParams();
  if (!searchParams) return params;
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry) params.append(key, entry);
      });
    } else if (value) {
      params.set(key, value);
    }
  });
  return params;
};

export default function OrganizationBillingRedirect({ searchParams }: PageProps) {
  const params = toQuery(searchParams);
  params.set("tab", "analyze");
  params.set("section", "invoices");
  redirect(`/organizacao?${params.toString()}`);
}
