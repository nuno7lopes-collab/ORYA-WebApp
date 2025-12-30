#!/usr/bin/env node
/**
 * Backfill stripe_fee_cents usando balance_transaction real da Stripe.
 * Atualiza sale_summaries (stripe_fee_cents, net_cents) e payment_events (stripe_fee_cents).
 * Segura: processa em batches pequenos; se algum intent não tiver charge/fee, apenas regista aviso.
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const Stripe = require("stripe");

// Carregar env de .env.local e .env manualmente (sem depender de dotenv)
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
    // remove quotes simples ou duplas envolventes
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

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("Falta STRIPE_SECRET_KEY no ambiente (.env.local)");
  process.exit(1);
}

const stripe = Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-09-30.acacia" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? undefined
      : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

async function main() {
  const batchSize = 200;
  const summaries = await prisma.saleSummary.findMany({
    where: { stripeFeeCents: 0 },
    select: {
      id: true,
      paymentIntentId: true,
      platformFeeCents: true,
      totalCents: true,
      netCents: true,
    },
    take: batchSize,
    orderBy: { id: "asc" },
  });

  console.log(`Encontradas ${summaries.length} sale_summaries sem stripe_fee_cents.`);
  let ok = 0;
  let skipped = 0;

  for (const s of summaries) {
    if (!s.paymentIntentId) {
      console.warn(`SaleSummary ${s.id} sem paymentIntentId, a ignorar`);
      skipped += 1;
      continue;
    }

    try {
      const intent = await stripe.paymentIntents.retrieve(s.paymentIntentId, {
        expand: ["latest_charge.balance_transaction"],
      });
      let fee = null;
      const charge = intent.latest_charge;
      if (charge && typeof charge === "object" && charge.balance_transaction && typeof charge.balance_transaction === "object") {
        fee = charge.balance_transaction.fee ?? null;
      }
      if (fee == null) {
        console.warn(`PI ${s.paymentIntentId}: sem fee real (sem balance_transaction).`);
        skipped += 1;
        continue;
      }

      const platformFee = s.platformFeeCents ?? 0;
      const total = s.totalCents ?? 0;
      const net = Math.max(0, total - platformFee - fee);

      await prisma.saleSummary.update({
        where: { id: s.id },
        data: { stripeFeeCents: fee, netCents: net },
      });
      await prisma.paymentEvent.updateMany({
        where: { stripePaymentIntentId: s.paymentIntentId },
        data: { stripeFeeCents: fee },
      });
      ok += 1;
    } catch (err) {
      console.error(`Falha no PI ${s.paymentIntentId} (saleSummary ${s.id}):`, err);
      skipped += 1;
    }
  }

  console.log(`Backfill sale_summaries concluído. Atualizados: ${ok}. Skipped/erros: ${skipped}.`);

  // Backfill payment_events stripe_fee_cents (quando não há sale_summary)
  const pevents = await prisma.paymentEvent.findMany({
    where: { stripeFeeCents: null },
    select: { id: true, stripePaymentIntentId: true },
    take: batchSize,
    orderBy: { id: "asc" },
  });

  console.log(`Encontrados ${pevents.length} payment_events sem stripe_fee_cents.`);
  let okPe = 0;
  let skipPe = 0;
  for (const p of pevents) {
    if (!p.stripePaymentIntentId) {
      skipPe++;
      continue;
    }
    try {
      const intent = await stripe.paymentIntents.retrieve(p.stripePaymentIntentId, {
        expand: ["latest_charge.balance_transaction"],
      });
      let fee = null;
      const charge = intent.latest_charge;
      if (charge && typeof charge === "object" && charge.balance_transaction && typeof charge.balance_transaction === "object") {
        fee = charge.balance_transaction.fee ?? null;
      }
      if (fee == null) {
        console.warn(`PaymentEvent ${p.id} PI ${p.stripePaymentIntentId}: sem fee real.`);
        skipPe++;
        continue;
      }
      await prisma.paymentEvent.update({
        where: { id: p.id },
        data: { stripeFeeCents: fee },
      });
      okPe++;
    } catch (err) {
      console.error(`Falha paymentEvent ${p.id} (${p.stripePaymentIntentId}):`, err);
      skipPe++;
    }
  }

  console.log(`Backfill payment_events concluído. Atualizados: ${okPe}. Skipped/erros: ${skipPe}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
