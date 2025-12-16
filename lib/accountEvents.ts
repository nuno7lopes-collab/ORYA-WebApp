import { prisma } from "@/lib/prisma";

export async function logAccountEvent(params: {
  userId: string;
  type: "account_delete_requested" | "account_delete_cancelled" | "account_delete_completed" | "account_restored";
  metadata?: Record<string, unknown>;
}) {
  // Modelo legacy removido; fallback para log simples.
  console.info("[accountEvents] event", {
    userId: params.userId,
    type: params.type,
    metadata: params.metadata ?? {},
  });
}
