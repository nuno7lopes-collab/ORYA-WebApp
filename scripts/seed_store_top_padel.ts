import fs from "node:fs";
import path from "node:path";
import {
  OrganizationModule,
  OrganizationStatus,
  PrismaClient,
  StoreStatus,
  StoreStockPolicy,
  StoreVisibility,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const loadEnvFile = (file: string) => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
};

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Falta DATABASE_URL ou DIRECT_URL.");
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === "production" ? undefined : { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error"] });

const now = new Date();
const requestedUsername = (process.env.STORE_TOP_PADEL_USERNAME ?? "top_padel").trim().toLowerCase();
const candidateUsernames = Array.from(new Set([requestedUsername, "top_padel", "top-padel", "toppadel"]));
const supportEmail = (process.env.STORE_TOP_PADEL_SUPPORT_EMAIL ?? "loja@top-padel.test").trim().toLowerCase();
const fakeStripeAccount = (process.env.STORE_TOP_PADEL_STRIPE_ACCOUNT ?? "acct_top_padel_test").trim();

type SeedProduct = {
  key: "raquete" | "bola" | "casaco";
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  priceCents: number;
  compareAtPriceCents: number;
  sku: string;
  stockQty: number;
  categorySlug: "equipamento" | "vestuario";
  imageUrl: string;
};

const productsToSeed: SeedProduct[] = [
  {
    key: "raquete",
    name: "Raquete Top Padel Carbon Pro",
    slug: "raquete-top-padel-carbon-pro",
    shortDescription: "Raquete de controlo e potencia para jogo competitivo.",
    description:
      "Raquete oficial Top Padel para treino e competicao. Equilibrio entre controlo e potencia, otima para testes de checkout e carrinho.",
    priceCents: 8990,
    compareAtPriceCents: 10990,
    sku: "TP-RAQ-001",
    stockQty: 50,
    categorySlug: "equipamento",
    imageUrl: "https://picsum.photos/seed/top-padel-raquete/1200/900",
  },
  {
    key: "bola",
    name: "Bola Top Padel Match (Pack 3)",
    slug: "bola-top-padel-match-pack-3",
    shortDescription: "Pack de 3 bolas pressurizadas para jogo rapido.",
    description:
      "Pack de bolas Top Padel Match com ressalto estavel e durabilidade para sessoes intensas. Produto ideal para testar compras rapidas.",
    priceCents: 590,
    compareAtPriceCents: 790,
    sku: "TP-BOL-003",
    stockQty: 200,
    categorySlug: "equipamento",
    imageUrl: "https://picsum.photos/seed/top-padel-bola/1200/900",
  },
  {
    key: "casaco",
    name: "Casaco Top Padel Club",
    slug: "casaco-top-padel-club",
    shortDescription: "Casaco leve oficial Top Padel para pre e pos-jogo.",
    description:
      "Casaco oficial Top Padel com ajuste confortavel e tecido leve. Perfeito para testar catalogo, carrinho e checkout com produto de vestuario.",
    priceCents: 3990,
    compareAtPriceCents: 4990,
    sku: "TP-CAS-001",
    stockQty: 80,
    categorySlug: "vestuario",
    imageUrl: "https://picsum.photos/seed/top-padel-casaco/1200/900",
  },
];

async function ensureOrganization() {
  const whereOr = candidateUsernames.map((username) => ({
    username: { equals: username, mode: "insensitive" as const },
  }));

  const existing = await prisma.organization.findFirst({
    where: { OR: whereOr },
    select: {
      id: true,
      username: true,
      publicName: true,
      status: true,
      groupId: true,
      orgType: true,
      officialEmail: true,
      officialEmailVerifiedAt: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
    },
  });

  if (existing) {
    return prisma.organization.update({
      where: { id: existing.id },
      data: {
        status: OrganizationStatus.ACTIVE,
        username: existing.username ?? requestedUsername,
        publicName: existing.publicName || "Top Padel",
        businessName: "Top Padel",
        officialEmail: existing.officialEmail ?? supportEmail,
        officialEmailVerifiedAt: existing.officialEmailVerifiedAt ?? now,
        stripeAccountId: existing.stripeAccountId ?? fakeStripeAccount,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
      },
      select: { id: true, username: true, publicName: true, status: true, orgType: true },
    });
  }

  const fallbackOwner = await prisma.profile.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!fallbackOwner) {
    throw new Error("Nao existe profile para owner do group.");
  }

  const group = await prisma.organizationGroup.create({
    data: { ownerUserId: fallbackOwner.id },
  });
  return prisma.organization.create({
    data: {
      groupId: group.id,
      status: OrganizationStatus.ACTIVE,
      username: requestedUsername,
      publicName: "Top Padel",
      businessName: "Top Padel",
      officialEmail: supportEmail,
      officialEmailVerifiedAt: now,
      stripeAccountId: fakeStripeAccount,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
    },
    select: { id: true, username: true, publicName: true, status: true, orgType: true },
  });
}

async function ensureStore(organizationId: number) {
  return prisma.store.upsert({
    where: { ownerOrganizationId: organizationId },
    update: {
      status: StoreStatus.ACTIVE,
      showOnProfile: true,
      catalogLocked: false,
      checkoutEnabled: true,
      currency: "EUR",
      supportEmail,
      returnPolicy:
        "Trocas em 14 dias para produtos sem sinais de uso. Em caso de defeito, contactar o suporte.",
      privacyPolicy: "Os teus dados sao usados apenas para gestao de encomendas e suporte.",
      termsUrl: "https://orya.pt/termos-loja-top-padel",
      freeShippingThresholdCents: 5000,
    },
    create: {
      ownerOrganizationId: organizationId,
      status: StoreStatus.ACTIVE,
      showOnProfile: true,
      catalogLocked: false,
      checkoutEnabled: true,
      currency: "EUR",
      supportEmail,
      returnPolicy:
        "Trocas em 14 dias para produtos sem sinais de uso. Em caso de defeito, contactar o suporte.",
      privacyPolicy: "Os teus dados sao usados apenas para gestao de encomendas e suporte.",
      termsUrl: "https://orya.pt/termos-loja-top-padel",
      freeShippingThresholdCents: 5000,
    },
    select: { id: true, status: true, showOnProfile: true, catalogLocked: true, checkoutEnabled: true },
  });
}

async function ensurePrimaryImage(productId: number, imageUrl: string, altText: string) {
  const existing = await prisma.storeProductImage.findFirst({
    where: { productId, isPrimary: true },
    select: { id: true },
    orderBy: [{ id: "asc" }],
  });

  if (existing) {
    return prisma.storeProductImage.update({
      where: { id: existing.id },
      data: { url: imageUrl, altText, sortOrder: 0, isPrimary: true },
      select: { id: true, url: true },
    });
  }

  return prisma.storeProductImage.create({
    data: { productId, url: imageUrl, altText, sortOrder: 0, isPrimary: true },
    select: { id: true, url: true },
  });
}

async function main() {
  const organization = await ensureOrganization();

  await prisma.organizationModuleEntry.upsert({
    where: {
      organizationId_moduleKey: {
        organizationId: organization.id,
        moduleKey: OrganizationModule.LOJA,
      },
    },
    update: { enabled: true },
    create: {
      organizationId: organization.id,
      moduleKey: OrganizationModule.LOJA,
      enabled: true,
    },
  });

  const store = await ensureStore(organization.id);

  const equipmentCategory = await prisma.storeCategory.upsert({
    where: {
      storeId_slug: {
        storeId: store.id,
        slug: "equipamento",
      },
    },
    update: {
      name: "Equipamento",
      description: "Material de jogo oficial Top Padel.",
      isActive: true,
      sortOrder: 1,
    },
    create: {
      storeId: store.id,
      name: "Equipamento",
      slug: "equipamento",
      description: "Material de jogo oficial Top Padel.",
      isActive: true,
      sortOrder: 1,
    },
    select: { id: true, slug: true },
  });

  const apparelCategory = await prisma.storeCategory.upsert({
    where: {
      storeId_slug: {
        storeId: store.id,
        slug: "vestuario",
      },
    },
    update: {
      name: "Vestuario",
      description: "Roupa oficial Top Padel para treino e competicao.",
      isActive: true,
      sortOrder: 2,
    },
    create: {
      storeId: store.id,
      name: "Vestuario",
      slug: "vestuario",
      description: "Roupa oficial Top Padel para treino e competicao.",
      isActive: true,
      sortOrder: 2,
    },
    select: { id: true, slug: true },
  });

  const byCategorySlug = new Map<string, number>([
    [equipmentCategory.slug, equipmentCategory.id],
    [apparelCategory.slug, apparelCategory.id],
  ]);

  const seededProducts: Array<{ id: number; slug: string; name: string; priceCents: number }> = [];

  for (const product of productsToSeed) {
    const categoryId = byCategorySlug.get(product.categorySlug) ?? null;

    const upserted = await prisma.storeProduct.upsert({
      where: {
        storeId_slug: {
          storeId: store.id,
          slug: product.slug,
        },
      },
      update: {
        categoryId,
        name: product.name,
        shortDescription: product.shortDescription,
        description: product.description,
        visibility: StoreVisibility.PUBLIC,
        priceCents: product.priceCents,
        compareAtPriceCents: product.compareAtPriceCents,
        currency: "EUR",
        sku: product.sku,
        stockPolicy: StoreStockPolicy.TRACKED,
        stockQty: product.stockQty,
        requiresShipping: false,
        tags: ["top-padel", "demo", "teste", product.key],
      },
      create: {
        storeId: store.id,
        categoryId,
        name: product.name,
        slug: product.slug,
        shortDescription: product.shortDescription,
        description: product.description,
        visibility: StoreVisibility.PUBLIC,
        priceCents: product.priceCents,
        compareAtPriceCents: product.compareAtPriceCents,
        currency: "EUR",
        sku: product.sku,
        stockPolicy: StoreStockPolicy.TRACKED,
        stockQty: product.stockQty,
        requiresShipping: false,
        tags: ["top-padel", "demo", "teste", product.key],
      },
      select: { id: true, slug: true, name: true, priceCents: true },
    });

    await ensurePrimaryImage(upserted.id, product.imageUrl, product.name);
    seededProducts.push(upserted);
  }

  const username = organization.username ?? requestedUsername;
  console.log("[seed-store-top-padel] OK");
  console.log(
    JSON.stringify(
      {
        organization: {
          id: organization.id,
          username,
          publicName: organization.publicName,
          status: organization.status,
          orgType: organization.orgType,
        },
        store: {
          id: store.id,
          status: store.status,
          showOnProfile: store.showOnProfile,
          catalogLocked: store.catalogLocked,
          checkoutEnabled: store.checkoutEnabled,
        },
        products: seededProducts,
        urls: {
          web: `/${username}/loja`,
          mobile: `/store/${username}`,
          dashboard: `/org/${organization.id}/store`,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error("[seed-store-top-padel] error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
