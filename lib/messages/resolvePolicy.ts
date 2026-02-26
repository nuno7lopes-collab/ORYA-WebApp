type ResolveScope = "org" | "b2c";

function normalizeContextType(value: string) {
  return value.trim().toUpperCase();
}

export function shouldEnforceMobileClientForResolve(params: {
  scope: ResolveScope;
  contextTypeRaw: string;
}) {
  const contextType = normalizeContextType(params.contextTypeRaw);

  if (contextType === "ORG_CHANNEL") {
    return params.scope === "b2c";
  }

  if (contextType === "ORG_COMMUNITY") {
    return false;
  }

  return true;
}
