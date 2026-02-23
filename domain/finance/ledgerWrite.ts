import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type DbClient = Prisma.TransactionClient | typeof prisma;
type LedgerEntryInput = Prisma.LedgerEntryCreateManyInput;

async function insertLedgerEntriesWithTx(
  tx: Prisma.TransactionClient,
  entries: LedgerEntryInput[],
) {
  if (!entries.length) return 0;
  const txUnsafe = tx as any;

  const paymentIds = Array.from(
    new Set(entries.map((entry) => String(entry.paymentId)).filter(Boolean)),
  ).sort();

  if (typeof txUnsafe.$executeRaw === "function") {
    for (const paymentId of paymentIds) {
      await txUnsafe.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${`finance:ledger:${paymentId}`}, 0))
      `;
    }
  }

  const keyTuples = entries
    .map((entry) => {
      const paymentId = String(entry.paymentId ?? "").trim();
      const causationId = String(entry.causationId ?? "").trim();
      if (!paymentId || !causationId) return null;
      return Prisma.sql`(${paymentId}, ${causationId})`;
    })
    .filter(Boolean) as Prisma.Sql[];

  const existing =
    keyTuples.length > 0 && typeof txUnsafe.$queryRaw === "function"
      ? await txUnsafe.$queryRaw<Array<{ paymentId: string; causationId: string }>>(Prisma.sql`
          SELECT
            payment_id AS "paymentId",
            causation_id AS "causationId"
          FROM app_v3.ledger_entries
          WHERE (payment_id, causation_id) IN (${Prisma.join(keyTuples)})
        `)
      : [];

  const existingKeys = new Set(
    existing.map((row) => `${row.paymentId}::${row.causationId}`),
  );

  const insertable = entries.filter((entry) => {
    const paymentId = String(entry.paymentId ?? "").trim();
    const causationId = String(entry.causationId ?? "").trim();
    if (!paymentId || !causationId) return false;
    return !existingKeys.has(`${paymentId}::${causationId}`);
  });

  if (!insertable.length) return 0;
  const created = await tx.ledgerEntry.createMany({
    data: insertable,
    skipDuplicates: true,
  });
  return created.count;
}

export async function insertLedgerEntriesSafely(params: {
  entries: LedgerEntryInput[];
  tx?: DbClient;
}) {
  const { entries, tx } = params;
  if (!entries.length) return 0;
  if (tx && tx !== prisma) {
    return insertLedgerEntriesWithTx(tx as Prisma.TransactionClient, entries);
  }
  return prisma.$transaction((transaction) =>
    insertLedgerEntriesWithTx(transaction, entries),
  );
}
