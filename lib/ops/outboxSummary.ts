import { getOpsSlo } from "@/domain/ops/slo";

export async function getOutboxOpsSummary() {
  const slo = await getOpsSlo();
  return { slo };
}
