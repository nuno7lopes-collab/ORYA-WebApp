type GeoErrorResponse = {
  status: number;
  message: string;
};

const resolveMessage = (err: unknown) => (err instanceof Error ? err.message : String(err ?? ""));

export function mapGeoError(err: unknown, fallback: string): GeoErrorResponse {
  const message = resolveMessage(err);
  if (message.includes("APPLE_MAPS_CONFIG_MISSING")) {
    return { status: 503, message: "Apple Maps não configurado. Contacta o administrador da plataforma." };
  }
  if (message.includes("APPLE_MAPS_COOLDOWN")) {
    return { status: 503, message: "Apple Maps temporariamente indisponível. Tenta novamente em instantes." };
  }
  if (message.startsWith("APPLE_MAPS_ERROR:401:")) {
    return {
      status: 502,
      message: "Apple Maps não autorizado. Verifica TEAM_ID, KEY_ID, PRIVATE_KEY e ORIGIN da Apple Maps.",
    };
  }
  if (message.startsWith("APPLE_MAPS_ERROR:")) {
    return { status: 502, message: "Apple Maps indisponível neste momento." };
  }
  return { status: 502, message: fallback };
}

export type { GeoErrorResponse };
