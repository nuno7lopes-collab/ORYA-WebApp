import { SourceType } from "@prisma/client";

type IntentLike = {
  id: string;
  amount: number | null;
  livemode: boolean;
  currency: string;
  metadata: Record<string, any>;
};

export async function fulfillPadelFullIntent(intent: IntentLike): Promise<boolean> {
  const meta = intent.metadata ?? {};
  const sourceType = typeof meta.sourceType === "string" ? meta.sourceType : null;
  if (sourceType === SourceType.PADEL_REGISTRATION || sourceType === "PADEL_REGISTRATION") {
    return false;
  }
  console.warn("[padel] legacy full ticket fulfillment disabled", { intentId: intent.id });
  return false;
}
