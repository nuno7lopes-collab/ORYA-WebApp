export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { MediaOwnerType } from "@prisma/client";
import { getActiveOrganizationForUser, ORG_ACTIVE_WRITE_OPTIONS } from "@/lib/organizationContext";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { getRequestContext } from "@/lib/http/requestContext";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { jsonWrap } from "@/lib/api/wrapResponse";

async function _POST(req: NextRequest) {
  try {
    const ctx = getRequestContext(req);
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const assetId = typeof body?.assetId === "string" ? body.assetId.trim() : "";
    if (!assetId) {
      return jsonWrap({ error: "ASSET_ID_REQUIRED" }, { status: 400 });
    }

    const asset = await prisma.mediaAsset.findUnique({
      where: { id: assetId },
      select: {
        id: true,
        ownerType: true,
        ownerId: true,
        organizationId: true,
        bucket: true,
        objectPath: true,
        deletedAt: true,
      },
    });
    if (!asset || asset.deletedAt) {
      return jsonWrap({ error: "ASSET_NOT_FOUND" }, { status: 404 });
    }

    if (asset.ownerType === MediaOwnerType.USER) {
      if (asset.ownerId !== user.id) {
        return jsonWrap({ error: "FORBIDDEN" }, { status: 403 });
      }
    } else if (asset.ownerType === MediaOwnerType.ORGANIZATION) {
      if (!asset.organizationId) {
        return jsonWrap({ error: "ORG_CONTEXT_MISSING" }, { status: 409 });
      }
      const { organization, membership } = await getActiveOrganizationForUser(user.id, {
        organizationId: asset.organizationId,
        ...ORG_ACTIVE_WRITE_OPTIONS,
      });
      if (!organization || !membership) {
        return jsonWrap({ error: "FORBIDDEN" }, { status: 403 });
      }
    }

    const removal = await supabaseAdmin.storage.from(asset.bucket).remove([asset.objectPath]);
    if (removal.error) {
      console.error("[POST /api/upload/delete] storage remove error", removal.error);
      return jsonWrap({ error: "STORAGE_REMOVE_FAILED" }, { status: 502 });
    }

    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: { deletedAt: new Date() },
    });

    if (asset.ownerType === MediaOwnerType.ORGANIZATION && asset.organizationId) {
      await recordOrganizationAudit(prisma, {
        organizationId: asset.organizationId,
        actorUserId: user.id,
        action: "MEDIA_DELETE",
        entityType: "MediaAsset",
        entityId: asset.id,
        correlationId: ctx.correlationId ?? null,
        metadata: {
          bucket: asset.bucket,
          objectPath: asset.objectPath,
        },
      });
    }

    return jsonWrap({ ok: true });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return jsonWrap({ error: "AUTH_REQUIRED" }, { status: 401 });
    }
    console.error("[POST /api/upload/delete]", err);
    return jsonWrap({ error: "DELETE_FAILED" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
