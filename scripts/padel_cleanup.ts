import { runPadelCleanup } from "@/domain/padel/cleanup";

const args = process.argv.slice(2);
const getArg = (name: string) => {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  const next = args[idx + 1];
  return next && !next.startsWith("--") ? next : "true";
};

const toNumber = (value: string | null) => {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const apply = getArg("--apply") === "true";
const limit = toNumber(getArg("--limit"));
const cursor = toNumber(getArg("--cursor"));
const eventId = toNumber(getArg("--eventId"));
const removeOrphans = getArg("--remove-orphans") === "true";
const orphanGraceHours = toNumber(getArg("--orphan-grace-hours"));

runPadelCleanup({
  apply,
  limit: limit ?? undefined,
  cursor: cursor ?? undefined,
  eventId: eventId ?? undefined,
  removeOrphanRegistrations: removeOrphans,
  orphanGraceHours: orphanGraceHours ?? undefined,
})
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((err) => {
    console.error("padel_cleanup_failed", err);
    process.exit(1);
  });
