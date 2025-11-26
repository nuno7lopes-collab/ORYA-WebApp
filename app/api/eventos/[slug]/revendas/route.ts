// Alias em PT para revendas — chama a lógica de /resales
import type { NextRequest } from "next/server";
import { GET as getResales } from "../resales/route";

export async function GET(
  req: NextRequest,
  context: { params: { slug?: string } | Promise<{ slug?: string }> },
) {
  return getResales(req, context);
}
