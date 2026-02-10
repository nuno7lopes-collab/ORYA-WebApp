const { Pool } = require("pg");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local", override: true });
dotenv.config();

const resolveConnectionString = () => {
  const direct = process.env.DIRECT_URL;
  if (direct) return direct;
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) return databaseUrl;
  throw new Error("DIRECT_URL ou DATABASE_URL não encontrados no ambiente.");
};

const resolveSsl = (connectionString) => {
  try {
    const parsed = new URL(connectionString);
    const host = parsed.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
    const disable =
      process.env.PGSSL_DISABLE === "true" ||
      process.env.PGSSLMODE === "disable" ||
      parsed.searchParams.get("sslmode") === "disable" ||
      isLocal;
    if (disable) return false;
  } catch {
    // ignore parse errors
  }
  return { rejectUnauthorized: false };
};

const mappings = [
  { templateType: "PADEL", tags: ["padel"] },
  { templateType: "PARTY", tags: ["festas"] },
  { templateType: "TALK", tags: ["workshops"] },
  { templateType: "VOLUNTEERING", tags: ["bem_estar"] },
  { templateType: "OTHER", tags: ["bem_estar"] },
];

const buildArrayLiteral = (tags) => `ARRAY[${tags.map((t) => `'${t}'`).join(",")}]::text[]`;

async function run() {
  console.log("[backfill_interest_tags] start");
  const connectionString = resolveConnectionString();
  const pool = new Pool({
    connectionString,
    ssl: resolveSsl(connectionString),
  });
  let totalEvents = 0;
  let totalIndex = 0;

  for (const mapping of mappings) {
    const arrayLiteral = buildArrayLiteral(mapping.tags);
    const templateType = mapping.templateType;

    const eventsCount = await pool.query(
      `UPDATE app_v3.events
       SET interest_tags = ${arrayLiteral}
       WHERE COALESCE(array_length(interest_tags, 1), 0) = 0
         AND template_type = '${templateType}'`,
    );

    const indexCount = await pool.query(
      `UPDATE app_v3.search_index_items
       SET interest_tags = ${arrayLiteral}
       WHERE COALESCE(array_length(interest_tags, 1), 0) = 0
         AND template_type = '${templateType}'`,
    );

    totalEvents += Number(eventsCount.rowCount || 0);
    totalIndex += Number(indexCount.rowCount || 0);

    console.log(
      `[backfill_interest_tags] ${templateType}: events=${eventsCount.rowCount} search_index_items=${indexCount.rowCount}`,
    );
  }

  console.log(
    `[backfill_interest_tags] done events=${totalEvents} search_index_items=${totalIndex}`,
  );
  await pool.end();
}

run()
  .catch((err) => {
    console.error("[backfill_interest_tags] failed", err);
    process.exitCode = 1;
  })
  .finally(() => {});
