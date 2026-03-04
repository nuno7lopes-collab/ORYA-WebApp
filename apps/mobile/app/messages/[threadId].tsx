import { Redirect, useLocalSearchParams } from "expo-router";

export default function LegacyMessageThreadRedirect() {
  const params = useLocalSearchParams();
  const threadIdRaw = params.threadId;
  const threadId = Array.isArray(threadIdRaw) ? threadIdRaw[0] : threadIdRaw;

  if (!threadId) {
    return <Redirect href="/comunidade/mensagens" />;
  }

  const forwardParams: Record<string, string> = { threadId };
  Object.entries(params).forEach(([key, value]) => {
    if (key === "threadId" || value == null) return;
    forwardParams[key] = Array.isArray(value) ? String(value[0] ?? "") : String(value);
  });

  return (
    <Redirect
      href={{
        pathname: "/comunidade/mensagens/[threadId]",
        params: forwardParams,
      }}
    />
  );
}
