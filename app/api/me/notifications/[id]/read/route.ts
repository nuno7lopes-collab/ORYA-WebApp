import { jsonWrap } from "@/lib/api/wrapResponse";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { markNotificationRead } from "@/domain/notifications/consumer";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const notificationId = params.id;
    if (!notificationId) {
      return jsonWrap(
        { ok: false, code: "INVALID_PAYLOAD", message: "notificationId é obrigatório" },
        { status: 400 },
      );
    }

    await markNotificationRead({ userId: user.id, notificationId });
    return jsonWrap({ ok: true });
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return jsonWrap({ ok: false, code: "UNAUTHENTICATED" }, { status: err.status ?? 401 });
    }
    console.error("[me][notifications][read] erro inesperado", err);
    return jsonWrap({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);
