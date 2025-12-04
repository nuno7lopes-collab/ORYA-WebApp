// Legacy alias: reutiliza a lógica atual de /api/payments/intent
import { POST as paymentsPost } from "../payments/intent/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = paymentsPost;
