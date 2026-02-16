import FinanceToolClient from "./FinanceToolClient";
import { isFinanceAllowedView, type FinanceAllowedView } from "@/lib/domainBoundaries";

export default async function OrgFinancePage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }> | { orgId: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const resolvedParams = (await Promise.resolve(params)) as { orgId: string };
  const orgId = Number(resolvedParams.orgId);
  const resolvedSearchParams: Record<string, string | string[] | undefined> =
    ((await Promise.resolve(searchParams)) ?? {}) as Record<string, string | string[] | undefined>;
  const readParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
  const viewParam = readParam(resolvedSearchParams.view);
  const view: FinanceAllowedView = isFinanceAllowedView(viewParam) ? viewParam : "overview";
  return <FinanceToolClient orgId={Number.isFinite(orgId) ? orgId : 0} initialView={view} />;
}
