import type { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { GET as geoGET } from "@/app/api/geo/details/route";

export const runtime = "nodejs";

const handler = (req: NextRequest) => geoGET(req);
export const GET = withApiEnvelope(handler);
