# Audit Inventory

## Module surface (file counts)

- app: 830 files
- apps: 161 files
- config: 1 files
- domain: 111 files
- infra: 8 files
- lib: 183 files
- packages: 9 files
- prisma: 113 files
- scripts: 70 files
- tests: 118 files

## File type distribution (top 15)

- .ts: 1024
- .tsx: 360
- .sql: 113
- .js: 33
- .png: 15
- .sh: 15
- .mjs: 14
- .json: 9
- .md: 4
- .css: 3
- (no_ext): 3
- .yaml: 3
- .ico: 1
- .example: 1
- .svg: 1

## Hotspot keywords (counts by top-level dir)

- scripts: 46
- lib: 34
- app: 29
- apps: 18
- prisma: 7
- tests: 6

## Sample hotspot hits (first 200)

```
scripts/v9_todo_gate.mjs:17:const TODO_RE = /\b(TODO|FIXME)\b/i;
scripts/v9_todo_gate.mjs:54:  console.error("V9 TODO/FIXME gate failed:");
scripts/v9_todo_gate.mjs:59:console.log("V9 TODO/FIXME gate: OK");
prisma/schema.prisma:5363:// Enum legacy removido (SSOT = PadelRegistration.status)
scripts/backfillStripeFees.js:26:    // remove quotes simples ou duplas envolventes
scripts/e2e/address_event_checklist.mjs:250:      assert(state.eventId, "eventId ausente para cleanup.");
lib/cron/jobs.ts:25:    key: "bookings-cleanup",
lib/cron/jobs.ts:29:    endpoint: "/api/cron/bookings/cleanup",
lib/cron/jobs.ts:32:    key: "reservations-cleanup",
lib/cron/jobs.ts:36:    endpoint: "/api/cron/reservations/cleanup",
scripts/seed_mobile_v1.ts:12: *   SEED_CLEAR=true (remove previous data for prefix before seeding)
scripts/cleanup_non_court_booking_resources.js:30:  console.log(`[cleanup] found ${count} non-court bookings with resource metadata`);
scripts/cleanup_non_court_booking_resources.js:45:    console.log("[cleanup] dry run. Pass --apply to update.");
scripts/cleanup_non_court_booking_resources.js:51:    console.log("[cleanup] nothing to update.");
scripts/cleanup_non_court_booking_resources.js:64:  console.log(`[cleanup] updated ${result.count} bookings.`);
scripts/cleanup_non_court_booking_resources.js:69:    console.error("[cleanup] failed", err);
scripts/db/gates.js:49:    console.error("[db:gates] Legacy access fields detected in app/. Remove or move to deprecated read-models.");
scripts/db/gates.js:55:    // Allowlist entries go here if we ever need legacy read-model exceptions.
scripts/db/address_renormalize.sql:1:-- Address re-normalization and cleanup (Apple Maps primary)
scripts/db/address_renormalize.sql:6:-- 1) Normalize legacy location_source values to APPLE_MAPS where applicable.
scripts/v9_generate_checklist.mjs:18:  if (/^- \[ \]\s/.test(trimmed)) return "TODO";
scripts/v9_generate_checklist.mjs:21:  if (/\bStatus\b.*:\s*TODO\b/i.test(trimmed)) return "TODO";
lib/events/accessPolicy.ts:26:  legacy?: LegacyAccessPayload | null;
lib/events/accessPolicy.ts:35:  source: "explicit" | "legacy" | "default";
lib/events/accessPolicy.ts:95:  legacy?: LegacyAccessPayload | null;
lib/events/accessPolicy.ts:99:  const { legacy, defaultMode, hasRestrictedTickets } = params;
lib/events/accessPolicy.ts:100:  const inviteOnlyFlag = legacy?.inviteOnly === true;
lib/events/accessPolicy.ts:102:    typeof legacy?.publicAccessMode === "string"
lib/events/accessPolicy.ts:103:      ? legacy.publicAccessMode.trim().toUpperCase()
lib/events/accessPolicy.ts:118:  legacy?: LegacyAccessPayload | null,
lib/events/accessPolicy.ts:122:  const ticketFlags = Array.isArray(legacy?.ticketTypes) ? legacy?.ticketTypes : [];
lib/events/accessPolicy.ts:179:  const hasRestrictedTickets = detectRestrictedTickets(params.legacy, params.hasRestrictedTickets);
lib/events/accessPolicy.ts:180:  const legacyMode = inferLegacyMode({ legacy: params.legacy, defaultMode, hasRestrictedTickets });
lib/events/accessPolicy.ts:199:    source: legacyMode.mode === defaultMode ? "default" : "legacy",
lib/env.ts:78:      return value.trim().replace(/\/+$/, ""); // remove trailing slash para URLs previsíveis
scripts/backfill_event_access_policy.ts:66:      legacy: {
scripts/backfill_event_access_policy.ts:108:      `[backfill_access_policy] WARN ${restrictedTicketWarnings} events had restricted tickets (legacy).`,
lib/organizationContext.ts:141:// @deprecated Prefer ORG_CONTEXT_UI or ORG_CONTEXT_API (split to avoid misuse).
scripts/cron-loop.js:129:    name: "bookings-cleanup",
scripts/cron-loop.js:131:    path: "/api/cron/bookings/cleanup",
scripts/cron-loop.js:135:    name: "reservations-cleanup",
scripts/cron-loop.js:137:    path: "/api/cron/reservations/cleanup",
scripts/cleanup_unverified_org_data.js:55:    console.log(`[cleanup-email] ${label}: 0`);
scripts/cleanup_unverified_org_data.js:60:    console.log(`[cleanup-email][dry-run] ${label}: ${count}`);
scripts/cleanup_unverified_org_data.js:64:  console.log(`[cleanup-email] ${label}: ${result.count}`);
scripts/cleanup_unverified_org_data.js:68:  console.log("[cleanup-email] A iniciar limpeza de dados sem email verificado.");
scripts/cleanup_unverified_org_data.js:70:    console.log("[cleanup-email] Modo dry-run. Use --apply para apagar.");
scripts/cleanup_unverified_org_data.js:109:  console.log("[cleanup-email] Orgs alvo:");
scripts/cleanup_unverified_org_data.js:121:  console.log(`[cleanup-email] Orgs sem email verificado: ${unverifiedOrgIds.length}`);
scripts/cleanup_unverified_org_data.js:122:  console.log(`[cleanup-email] Orgs com stripe incompleto (servicos): ${stripeBlockedOrgIds.length}`);
scripts/cleanup_unverified_org_data.js:162:    console.log("[cleanup-email] Verificacao final:");
scripts/cleanup_unverified_org_data.js:169:  console.log("[cleanup-email] Limpeza concluida.");
scripts/cleanup_unverified_org_data.js:174:    console.error("[cleanup-email] Erro:", err);
scripts/v9_parity_gate.mjs:28:const legacyUsed = sectionHasItems("C) Frontend chama endpoint legacy/410");
scripts/v9_parity_gate.mjs:33:  if (legacyUsed) console.error("- Frontend calls legacy/410 endpoints");
scripts/v9_inventory.mjs:107:  const legacy = [];
scripts/v9_inventory.mjs:108:  if (/@deprecated/i.test(content)) legacy.push("@deprecated");
scripts/v9_inventory.mjs:109:  if (/LEGACY_/i.test(content)) legacy.push("LEGACY_");
scripts/v9_inventory.mjs:110:  return legacy;
scripts/v9_inventory.mjs:234:      `| ${entry.route} | ${entry.file} | ${entry.methods.join(", ") || "unknown"} | ${entry.type} | ${entry.auth} | ${entry.payloads.join(", ")} | ${entry.statusCodes.join(", ") || "unknown"} | ${entry.runtime.runtime}/${entry.runtime.dynamic}/${entry.runtime.revalidate} | ${entry.cache} | ${entry.envelope} | ${entry.legacy.length ? entry.legacy.join(", ") : "-"} |`
scripts/v9_inventory.mjs:319:    lines.push(`- ${entry.route} (${entry.type}${entry.legacy ? ", legacy" : ""})`);
scripts/v9_inventory.mjs:328:  lines.push("## C) Frontend chama endpoint legacy/410");
scripts/v9_inventory.mjs:371:      legacy: detectLegacy(content),
scripts/v9_inventory.mjs:451:    if (entry.legacy.length === 0) continue;
scripts/v9_inventory.mjs:463:    unusedApi: unusedApi.map((entry) => ({ route: entry.route, type: entry.type, legacy: entry.legacy.length > 0 })),
prisma/migrations/20260129160535_outbox_dedupe_claim/migration.sql:6:-- Backfill causation_id for legacy rows, then set dedupe_key to canonical (event_type:causation_id)
app/loja/seguimento/page.tsx:172:      link.remove();
lib/globalUsernames.ts:134: * Útil em deletes/cleanup de conta/org.
prisma/migrations/0051_drop_sale_legacy_v7/migration.sql:1:-- v7 cleanup: drop legacy sale tables + stripe_payment_intent_id columns
prisma/migrations/0001_padel_cleanup/migration.sql:1:-- Padel cleanup: remove legacy teams in favor of pairings
prisma/migrations/0006_remove_event_test_flag/migration.sql:1:-- Remove legacy test flag from events
apps/mobile/lib/auth.tsx:66:      subscription.remove();
lib/http/envelope.ts:171:    const legacy = payload as Record<string, unknown>;
lib/http/envelope.ts:172:    if (legacy.ok === true) {
lib/http/envelope.ts:173:      return respondOk(ctx, normalizeLegacySuccess(legacy), init);
lib/http/envelope.ts:175:    if (legacy.ok === false) {
lib/http/envelope.ts:177:        normalizeLegacyError(legacy);
lib/theme/runtime.ts:180:  const legacy = readThemeDraft(window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY));
lib/theme/runtime.ts:181:  if (legacy) {
lib/theme/runtime.ts:182:    window.localStorage.setItem(storageKey, JSON.stringify(legacy));
lib/theme/runtime.ts:183:    return legacy;
prisma/migrations/0002_remove_staff_legacy/migration.sql:1:-- Remove legacy staff assignments and staff notification types.
apps/mobile/package-lock.json:2924:        "react-remove-scroll": "^2.6.3"
apps/mobile/package-lock.json:3420:      "deprecated": "Glob versions prior to v9 are no longer supported",
apps/mobile/package-lock.json:7198:      "deprecated": "This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.",
apps/mobile/package-lock.json:10129:      "deprecated": "react-native-vector-icons package has moved to a new model of per-icon-family packages. See the https://github.com/oblador/react-native-vector-icons/blob/master/MIGRATION.md on how to migrate",
apps/mobile/package-lock.json:10342:      "deprecated": "Glob versions prior to v9 are no longer supported",
apps/mobile/package-lock.json:10389:    "node_modules/react-remove-scroll": {
apps/mobile/package-lock.json:10391:      "resolved": "https://registry.npmjs.org/react-remove-scroll/-/react-remove-scroll-2.7.2.tgz",
apps/mobile/package-lock.json:10395:        "react-remove-scroll-bar": "^2.3.7",
apps/mobile/package-lock.json:10414:    "node_modules/react-remove-scroll-bar": {
apps/mobile/package-lock.json:10416:      "resolved": "https://registry.npmjs.org/react-remove-scroll-bar/-/react-remove-scroll-bar-2.3.8.tgz",
apps/mobile/package-lock.json:10661:      "deprecated": "Rimraf versions prior to v4 are no longer supported",
apps/mobile/package-lock.json:10687:      "deprecated": "Glob versions prior to v9 are no longer supported",
apps/mobile/package-lock.json:11419:      "deprecated": "Glob versions prior to v9 are no longer supported",
lib/ownership/claimIdentity.ts:36:    // legacy summaries removidos no v7 (ledger + entitlements)
prisma/migrations/0059_drop_padel_pairing_lifecycle_v7/migration.sql:1:-- D12.5: remover lifecycle_status legacy (SSOT = PadelRegistration.status)
lib/supabaseServer.ts:111:        remove(name: string, options: Record<string, unknown>) {
lib/username.ts:15:    .replace(/[\u0300-\u036f]/g, ""); // remove diacríticos
lib/organizationPermissions.ts:38:// @deprecated Prefer role pack aware access (resolveMemberModuleAccess/ensureMemberModuleAccess).
lib/operations/fulfillPadelSplit.ts:17:  console.warn("[padel] legacy split ticket fulfillment disabled", { intentId: intent.id });
lib/operations/fulfillPadelFull.ts:17:  console.warn("[padel] legacy full ticket fulfillment disabled", { intentId: intent.id });
app/admin/utilizadores/UsersTableClient.tsx:132:                          "Eliminar em definitivo este utilizador? Esta ação remove do Auth e do perfil.",
apps/mobile/app/event/[slug].tsx:734:                            <Ionicons name="remove" size={16} color="rgba(255,255,255,0.75)" />
app/organizacao/(dashboard)/staff/page.tsx:669:      console.error("[staff] remove error", err);
app/organizacao/(dashboard)/staff/page.tsx:1550:        description={`Isto remove ${removeTarget?.fullName || removeTarget?.username || "este membro"} desta organização.`}
app/admin/infra/InfraClient.tsx:375:    link.remove();
apps/mobile/app/_layout.tsx:22:  "SafeAreaView has been deprecated",
apps/mobile/app/_layout.tsx:23:  "SafeAreaView is deprecated",
app/api/me/store/products/[id]/digital-assets/[assetId]/route.ts:209:    const removal = await supabaseAdmin.storage.from(bucket).remove([asset.storagePath]);
app/api/me/store/products/[id]/digital-assets/[assetId]/route.ts:211:      console.warn("[DELETE /api/me/store/products/[id]/digital-assets/[assetId]] remove error", removal.error);
app/organizacao/(dashboard)/eventos/[id]/PadelTournamentRolesPanel.tsx:109:      console.error("[padel/roles] remove", err);
app/organizacao/(dashboard)/eventos/[id]/PadelTournamentTabs.tsx:86:    description: "Aceita qualquer score (modo legacy)",
app/me/compras/loja/page.tsx:250:      link.remove();
app/me/compras/loja/[orderId]/page.tsx:184:      link.remove();
app/organizacao/OrganizationTour.tsx:264:      anchorEl.classList.remove("tour-highlight-ring");
apps/mobile/app/auth/callback.tsx:119:      sub.remove();
app/api/cron/reservations/cleanup/route.ts:3:// app/api/cron/reservations/cleanup/route.ts
app/api/cron/reservations/cleanup/route.ts:45:    // 2) Optional cleanup: remove EXPIRED older than 24h
app/api/cron/reservations/cleanup/route.ts:55:    await recordCronHeartbeat("reservations-cleanup", { status: "SUCCESS", startedAt });
app/api/cron/reservations/cleanup/route.ts:64:    await recordCronHeartbeat("reservations-cleanup", { status: "ERROR", startedAt, error: err });
app/api/cron/reservations/cleanup/route.ts:66:      { ok: false, error: "Internal cleanup error" },
app/api/cron/bookings/cleanup/route.ts:126:    await recordCronHeartbeat("bookings-cleanup", { status: "SUCCESS", startedAt });
app/api/cron/bookings/cleanup/route.ts:134:    await recordCronHeartbeat("bookings-cleanup", { status: "ERROR", startedAt, error: err });
app/api/cron/bookings/cleanup/route.ts:135:    return jsonWrap({ ok: false, error: "Internal cleanup error" }, { status: 500 });
app/organizacao/(dashboard)/padel/PadelHubClient.tsx:508:    setTimeout(() => el.remove(), 180);
app/organizacao/(dashboard)/padel/PadelHubClient.tsx:7410:            "Se estiver em uso, remove-a dos torneios ou desativa antes de apagar.",
app/components/BackgroundShell.tsx:143:    classList.remove("orya-bg-user", "orya-bg-event", "orya-bg-org", "orya-bg-landing");
app/components/BackgroundShell.tsx:147:      classList.remove(bgClass);
app/organizacao/DashboardClient.tsx:4851:              ? "Esta ação remove o rascunho e bilhetes associados."
tests/ops/agendaDriftGuardrails.test.ts:14:  "app/api/cron/bookings/cleanup/route.ts",
tests/http/wrapResponse.test.ts:22:  it("normalizes legacy ok=true shapes without data", async () => {
tests/http/wrapResponse.test.ts:66:  it("normalizes legacy success shape", async () => {
tests/http/wrapResponse.test.ts:78:  it("normalizes legacy failure shape", async () => {
tests/padel/registrationStatus.test.ts:67:  it("derives registration status from pairing lifecycle (legacy)", () => {
tests/entitlements/status.test.ts:37:  it("legacy mapper mantém ACTIVE como efetivo", () => {
app/api/padel/pairings/[id]/cancel/route.ts:96:      // Marca pairing cancelado e remove token para impedir novos claims
app/api/organizacao/events/create/route.ts:520:      legacy: body,
app/api/organizacao/loja/products/[id]/digital-assets/[assetId]/route.ts:235:    const removal = await supabaseAdmin.storage.from(bucket).remove([asset.storagePath]);
app/api/organizacao/loja/products/[id]/digital-assets/[assetId]/route.ts:237:      console.warn("[DELETE /api/organizacao/loja/products/[id]/digital-assets/[assetId]] remove error", removal.error);
```
