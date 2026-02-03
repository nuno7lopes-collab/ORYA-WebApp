import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { getPublicDiscoverBySlug } from "@/domain/search/publicDiscover";

type RouteParams = {
  params: Promise<{ slug: string }>;
};

async function _GET(_: Request, context: RouteParams) {
  const { slug } = await context.params;
  const event = await getPublicDiscoverBySlug(slug);

  if (!event) {
    return jsonWrap({ message: "Evento não encontrado." }, { status: 404 });
  }

  return jsonWrap({ item: event });
}

export const GET = withApiEnvelope(_GET);
