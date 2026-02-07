export type ReleaseResult = {
  id: number;
  status: "SKIPPED";
  transferId?: string | null;
  error?: string;
};

const PAYOUT_CONTROL_DISABLED = true;

export async function releaseSinglePayout(payoutId: number): Promise<ReleaseResult> {
  if (PAYOUT_CONTROL_DISABLED) {
    return { id: payoutId, status: "SKIPPED", error: "PAYOUT_CONTROL_DISABLED" };
  }
  return { id: payoutId, status: "SKIPPED", error: "PAYOUT_CONTROL_DISABLED" };
}

export async function releaseDuePayouts(_limit = 25): Promise<ReleaseResult[]> {
  if (PAYOUT_CONTROL_DISABLED) return [];
  return [];
}
