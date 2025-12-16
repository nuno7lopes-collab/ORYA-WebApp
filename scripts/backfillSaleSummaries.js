#!/usr/bin/env node
/**
 * Constrói sale_summaries e sale_lines a partir de tickets + payment_events (sem tocar em intents já existentes).
 * Uso: node scripts/backfillSaleSummaries.js
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const Stripe = require("stripe");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL no ambiente.");
  process.exit(1);
}

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe =
  stripeSecret && stripeSecret.trim()
    ? new Stripe(stripeSecret, { apiVersion: "2024-09-30.acacia" })
    : null;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

async function getStripeFeeReal(paymentIntentId) {
  if (!stripe) return null;
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });
    const charge = pi.latest_charge;
    if (charge && typeof charge === "object" && charge.balance_transaction && typeof charge.balance_transaction === "object") {
      return charge.balance_transaction.fee ?? null;
    }
    return null;
  } catch (err) {
    console.warn(`[backfillSaleSummaries] Não foi possível obter fee real para ${paymentIntentId}:`, err.message);
    return null;
  }
}

async function main() {
  // Pegar intents sem sale_summary
  const tickets = await prisma.ticket.findMany({
    where: {
      stripePaymentIntentId: { not: null },
      status: { in: ["ACTIVE", "USED"] },
    },
    select: {
      id: true,
      stripePaymentIntentId: true,
      eventId: true,
      ticketTypeId: true,
      pricePaid: true,
      totalPaidCents: true,
      platformFeeCents: true,
      purchasedAt: true,
    },
  });

  const existingSummaries = new Set(
    (
      await prisma.saleSummary.findMany({
        select: { paymentIntentId: true },
      })
    )
      .map((s) => s.paymentIntentId)
      .filter(Boolean),
  );

  const intentGroups = new Map();
  tickets.forEach((t) => {
    if (!t.stripePaymentIntentId || existingSummaries.has(t.stripePaymentIntentId)) return;
    if (!intentGroups.has(t.stripePaymentIntentId)) {
      intentGroups.set(t.stripePaymentIntentId, []);
    }
    intentGroups.get(t.stripePaymentIntentId).push(t);
  });

  console.log(`Intents sem sale_summary: ${intentGroups.size}`);
  let created = 0;
  for (const [intentId, group] of intentGroups.entries()) {
    const eventId = group[0].eventId;
    const platformFee = group.reduce((sum, t) => sum + (t.platformFeeCents ?? 0), 0);
    const subtotal = group.reduce((sum, t) => sum + (t.pricePaid ?? 0), 0);
    const totalPaid = group.reduce((sum, t) => sum + (t.totalPaidCents ?? t.pricePaid ?? 0), 0);

    const pe = await prisma.paymentEvent.findFirst({
      where: { stripePaymentIntentId: intentId },
      select: { stripeFeeCents: true, platformFeeCents: true, amountCents: true, eventId: true },
    });
    const stripeFeeReal = pe?.stripeFeeCents ?? (await getStripeFeeReal(intentId));
    const stripeFee = stripeFeeReal ?? 0;
    const totalFees = platformFee + stripeFee;
    const totalCents = totalPaid + platformFee; // cliente pagou totalPaid; platform fee adicionada (caso ADDED)
    const net = Math.max(0, totalCents - totalFees);

    const linesByType = new Map();
    group.forEach((t) => {
      if (!linesByType.has(t.ticketTypeId)) {
        linesByType.set(t.ticketTypeId, { qty: 0, gross: 0, fee: 0 });
      }
      const entry = linesByType.get(t.ticketTypeId);
      entry.qty += 1;
      entry.gross += t.pricePaid ?? 0;
      entry.fee += t.platformFeeCents ?? 0;
      linesByType.set(t.ticketTypeId, entry);
    });

    try {
      const summary = await prisma.saleSummary.create({
        data: {
          paymentIntentId: intentId,
          eventId,
          userId: null,
          promoCodeId: null,
          subtotalCents: subtotal,
          discountCents: 0,
          platformFeeCents: platformFee,
          stripeFeeCents: stripeFee,
          totalCents: totalCents,
          netCents: net,
          feeMode: null,
          currency: "EUR",
          promoCodeSnapshot: null,
          promoLabelSnapshot: null,
          promoTypeSnapshot: null,
          promoValueSnapshot: null,
        },
      });

      for (const [ticketTypeId, entry] of linesByType.entries()) {
        await prisma.saleLine.create({
          data: {
            saleSummaryId: summary.id,
            eventId,
            ticketTypeId,
            promoCodeId: null,
            quantity: entry.qty,
            unitPriceCents: Math.round(entry.gross / entry.qty),
            discountPerUnitCents: 0,
            grossCents: entry.gross,
            netCents: Math.max(0, entry.gross - entry.fee),
            platformFeeCents: entry.fee,
            promoCodeSnapshot: null,
            promoLabelSnapshot: null,
            promoTypeSnapshot: null,
            promoValueSnapshot: null,
          },
        });
      }
      created += 1;
    } catch (err) {
      console.error(`[backfillSaleSummaries] Falha ao criar sale_summary para ${intentId}:`, err.message);
    }
  }

  console.log(`Sale_summaries criados: ${created}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
