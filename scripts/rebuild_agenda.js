#!/usr/bin/env node
/* eslint-disable no-console */

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
  allowImportingTsExtensions: true,
});

require("./load-env");
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const { rebuildAgendaItems } = require("../domain/agendaReadModel/consumer");

function usage() {
  console.log("Usage: node scripts/rebuild_agenda.js --org <id> | --all [--batch <size>]");
}

async function main() {
  const args = process.argv.slice(2);
  let organizationId = null;
  let all = false;
  let batchSize = 500;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--all") {
      all = true;
      continue;
    }
    if (arg === "--batch" || arg === "--batchSize") {
      batchSize = Number(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith("--batch=")) {
      batchSize = Number(arg.split("=")[1]);
      continue;
    }
    if (arg === "--org" || arg === "--orgId") {
      organizationId = Number(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg.startsWith("--org=")) {
      organizationId = Number(arg.split("=")[1]);
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      usage();
      return;
    }
  }

  if (!all && !Number.isFinite(organizationId)) {
    usage();
    process.exit(1);
  }

  if (all) organizationId = null;

  const logger = (message, meta) => {
    if (meta) console.log(`[agenda][rebuild] ${message}`, meta);
    else console.log(`[agenda][rebuild] ${message}`);
  };

  const result = await rebuildAgendaItems({
    organizationId,
    batchSize,
    logger,
  });
  console.log("[agenda][rebuild] summary", result);
}

main().catch((err) => {
  console.error("agenda rebuild error:", err);
  process.exit(1);
});
