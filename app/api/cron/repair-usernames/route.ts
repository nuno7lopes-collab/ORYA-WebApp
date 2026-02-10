export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeAndValidateUsername, setUsernameForOwner } from "@/lib/globalUsernames";
import { normalizeUsernameInput } from "@/lib/username";
import type { Prisma } from "@prisma/client";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { requireInternalSecret } from "@/lib/security/requireInternalSecret";
import { recordCronHeartbeat } from "@/lib/cron/heartbeat";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const PAGE_SIZE = 500;

function ensureInternalSecret(req: NextRequest, ctx: { requestId: string; correlationId: string }) {
  if (!requireInternalSecret(req)) {
    return respondError(
      ctx,
      { errorCode: "UNAUTHORIZED", message: "Unauthorized.", retryable: false },
      { status: 401 },
    );
  }
  return null;
}

type SupabaseProfileRow = {
  id: string;
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  bio?: string | null;
  padel_level?: string | null;
  favourite_categories?: string[] | null;
  visibility?: string | null;
  onboarding_done?: boolean | null;
  onboardingDone?: boolean | null;
};

type ProfileVisibility = "PUBLIC" | "PRIVATE" | "FOLLOWERS";

const PROFILE_SELECT =
  "id, full_name, username, avatar_url, cover_url, bio, padel_level, favourite_categories, visibility, onboarding_done, onboardingDone";

function normalizeVisibility(value: unknown): ProfileVisibility {
  return value === "PUBLIC" || value === "PRIVATE" || value === "FOLLOWERS" ? value : "PUBLIC";
}

function resolveOnboardingDone(row: SupabaseProfileRow) {
  if (typeof row.onboarding_done === "boolean") return row.onboarding_done;
  if (typeof row.onboardingDone === "boolean") return row.onboardingDone;
  return false;
}

function shouldFallbackSupabase(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false;
  if (error.code === "PGRST205") return true;
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("schema cache") || message.includes("does not exist");
}

async function fetchProfilesPage(offset: number, pageSize: number) {
  const response = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_SELECT)
    .order("id", { ascending: true })
    .range(offset, offset + pageSize - 1);
  if (response.error && shouldFallbackSupabase(response.error)) {
    return { data: null, error: null, missing: true as const };
  }
  return { data: response.data, error: response.error, missing: false as const };
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  const unauthorized = ensureInternalSecret(req, ctx);
  if (unauthorized) return unauthorized;

  const url = new URL(req.url);
  const maxRecordsRaw = url.searchParams.get("max");
  const pageSizeRaw = url.searchParams.get("pageSize");
  const maxRecordsParsed = maxRecordsRaw ? Number(maxRecordsRaw) : NaN;
  const pageSizeParsed = pageSizeRaw ? Number(pageSizeRaw) : NaN;
  const maxRecords = Number.isFinite(maxRecordsParsed) ? Math.max(1, maxRecordsParsed) : null;
  const pageSize = Number.isFinite(pageSizeParsed)
    ? Math.min(1000, Math.max(50, pageSizeParsed))
    : PAGE_SIZE;

  const startedAt = new Date();
  const stats = {
    source: "supabase" as "supabase" | "prisma",
    scanned: 0,
    created: 0,
    updated: 0,
    usernameSet: 0,
    usernameSkipped: 0,
    usernameErrors: 0,
    orgsProcessed: 0,
    orgUsernameSet: 0,
    orgUsernameErrors: 0,
    errors: [] as Array<{ id: string; message: string }>,
  };

  try {
    let offset = 0;
    let done = false;

    while (!done) {
      const { data, error, missing } = await fetchProfilesPage(offset, pageSize);
      if (missing) {
        stats.source = "prisma";
        break;
      }

      if (error) {
        throw new Error(error.message || "Supabase profiles fetch failed.");
      }

      const rows = (data ?? []) as SupabaseProfileRow[];
      if (!rows.length) break;

      for (const row of rows) {
        if (maxRecords && stats.scanned >= maxRecords) {
          done = true;
          break;
        }
        stats.scanned += 1;
        const rawUsername = typeof row.username === "string" ? row.username : "";
        const normalizedInput = rawUsername ? normalizeUsernameInput(rawUsername) : "";
        const validated = normalizedInput ? normalizeAndValidateUsername(normalizedInput) : null;
        const safeUsername = validated?.ok ? validated.username : null;
        const sourceUsername = normalizedInput || null;
        const visibility = normalizeVisibility(row.visibility);
        const onboardingDone = resolveOnboardingDone(row);

        try {
          await prisma.$transaction(async (tx) => {
            const existing = await tx.profile.findUnique({
              where: { id: row.id },
              select: {
                id: true,
                username: true,
                fullName: true,
                avatarUrl: true,
                coverUrl: true,
                bio: true,
                padelLevel: true,
                favouriteCategories: true,
                visibility: true,
                onboardingDone: true,
              },
            });

            let usernameToPersist = existing?.username ?? sourceUsername ?? null;
            if (!usernameToPersist && safeUsername) {
              try {
                const result = await setUsernameForOwner({
                  username: safeUsername,
                  ownerType: "user",
                  ownerId: row.id,
                  tx,
                });
                if (result.ok) {
                  usernameToPersist = safeUsername;
                  stats.usernameSet += 1;
                } else {
                  stats.usernameSkipped += 1;
                }
              } catch {
                stats.usernameSkipped += 1;
              }
            } else if (usernameToPersist) {
              try {
                const result = await setUsernameForOwner({
                  username: usernameToPersist,
                  ownerType: "user",
                  ownerId: row.id,
                  tx,
                });
                if (result.ok) {
                  stats.usernameSet += 1;
                } else {
                  stats.usernameErrors += 1;
                }
              } catch {
                stats.usernameErrors += 1;
              }
            }

            if (!existing) {
              await tx.profile.create({
                data: {
                  id: row.id,
                  fullName: row.full_name ?? null,
                  username: usernameToPersist,
                  avatarUrl: row.avatar_url ?? null,
                  coverUrl: row.cover_url ?? null,
                  bio: row.bio ?? null,
                  padelLevel: row.padel_level ?? null,
                  favouriteCategories: Array.isArray(row.favourite_categories)
                    ? row.favourite_categories
                    : [],
                  visibility,
                  onboardingDone,
                  roles: ["user"],
                },
              });
              stats.created += 1;
              return;
            }

            const update: Prisma.ProfileUpdateInput = {};
            if (!existing.fullName && row.full_name) update.fullName = row.full_name;
            if (!existing.username && usernameToPersist) update.username = usernameToPersist;
            if (!existing.avatarUrl && row.avatar_url) update.avatarUrl = row.avatar_url;
            if (!existing.coverUrl && row.cover_url) update.coverUrl = row.cover_url;
            if (!existing.bio && row.bio) update.bio = row.bio;
            if (!existing.padelLevel && row.padel_level) update.padelLevel = row.padel_level;
            if (
              (!Array.isArray(existing.favouriteCategories) ||
                existing.favouriteCategories.length === 0) &&
              Array.isArray(row.favourite_categories) &&
              row.favourite_categories.length > 0
            ) {
              update.favouriteCategories = row.favourite_categories;
            }
            if (!existing.visibility && visibility) update.visibility = visibility;
            if (existing.onboardingDone !== true && onboardingDone === true) {
              update.onboardingDone = true;
            }

            if (Object.keys(update).length) {
              await tx.profile.update({
                where: { id: row.id },
                data: update,
              });
              stats.updated += 1;
            }
          });
        } catch (err) {
          if (stats.errors.length < 50) {
            stats.errors.push({
              id: row.id,
              message: err instanceof Error ? err.message : String(err ?? "unknown"),
            });
          }
        }
      }

      offset += rows.length;
      if (rows.length < pageSize) break;
    }

    if (stats.source === "prisma") {
      let cursor: string | null = null;
      let exhausted = false;
      while (!exhausted) {
        const batch = await prisma.profile.findMany({
          select: { id: true, username: true },
          orderBy: { id: "asc" },
          take: pageSize,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });
        if (!batch.length) break;
        for (const profile of batch) {
          if (maxRecords && stats.scanned >= maxRecords) {
            exhausted = true;
            break;
          }
          stats.scanned += 1;
          const rawUsername = typeof profile.username === "string" ? profile.username : "";
          const normalizedInput = rawUsername ? normalizeUsernameInput(rawUsername) : "";
          const validated = normalizedInput ? normalizeAndValidateUsername(normalizedInput) : null;
          const safeUsername = validated?.ok ? validated.username : null;
          if (!safeUsername) {
            stats.usernameSkipped += 1;
            continue;
          }
          try {
            const result = await setUsernameForOwner({
              username: safeUsername,
              ownerType: "user",
              ownerId: profile.id,
            });
            if (result.ok) stats.usernameSet += 1;
            else stats.usernameErrors += 1;
          } catch {
            stats.usernameErrors += 1;
          }
        }
        cursor = batch[batch.length - 1]?.id ?? null;
        if (batch.length < pageSize) break;
      }
    }

    let orgCursor: number | null = null;
    while (true) {
      const orgBatch = await prisma.organization.findMany({
        select: { id: true, username: true },
        orderBy: { id: "asc" },
        take: pageSize,
        ...(orgCursor ? { skip: 1, cursor: { id: orgCursor } } : {}),
      });
      if (!orgBatch.length) break;
      for (const org of orgBatch) {
        stats.orgsProcessed += 1;
        const rawUsername = typeof org.username === "string" ? org.username : "";
        const normalizedInput = rawUsername ? normalizeUsernameInput(rawUsername) : "";
        const validated = normalizedInput ? normalizeAndValidateUsername(normalizedInput) : null;
        const safeUsername = validated?.ok ? validated.username : null;
        if (!safeUsername) continue;
        try {
          const result = await setUsernameForOwner({
            username: safeUsername,
            ownerType: "organization",
            ownerId: org.id,
          });
          if (result.ok) stats.orgUsernameSet += 1;
          else stats.orgUsernameErrors += 1;
        } catch {
          stats.orgUsernameErrors += 1;
        }
      }
      orgCursor = orgBatch[orgBatch.length - 1]?.id ?? null;
      if (orgBatch.length < pageSize) break;
    }

    await recordCronHeartbeat("repair-usernames", {
      status: "SUCCESS",
      startedAt,
      metadata: {
        source: stats.source,
        scanned: stats.scanned,
        created: stats.created,
        updated: stats.updated,
        usernameSet: stats.usernameSet,
        usernameSkipped: stats.usernameSkipped,
        usernameErrors: stats.usernameErrors,
        orgsProcessed: stats.orgsProcessed,
        orgUsernameSet: stats.orgUsernameSet,
        orgUsernameErrors: stats.orgUsernameErrors,
        errors: stats.errors.length,
      },
    });

    return respondOk(ctx, { stats }, { status: 200 });
  } catch (err) {
    await recordCronHeartbeat("repair-usernames", {
      status: "ERROR",
      startedAt,
      error: err,
    });
    const errorMessage = err instanceof Error ? err.message : String(err ?? "unknown");
    const details = process.env.NODE_ENV !== "production" ? { error: errorMessage } : null;
    return respondError(
      ctx,
      {
        errorCode: "INTERNAL_ERROR",
        message: "Erro ao reparar usernames.",
        retryable: true,
        ...(details ? { details } : {}),
      },
      { status: 500 },
    );
  }
}

export const POST = withApiEnvelope(_POST);
