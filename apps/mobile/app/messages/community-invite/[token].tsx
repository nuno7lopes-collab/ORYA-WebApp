import { Redirect, useLocalSearchParams } from "expo-router";

export default function LegacyCommunityInviteRedirect() {
  const params = useLocalSearchParams();
  const tokenRaw = params.token;
  const token = Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw;

  if (!token) {
    return <Redirect href="/comunidade/mensagens" />;
  }

  return (
    <Redirect
      href={{
        pathname: "/comunidade/mensagens/convite/[token]",
        params: { token },
      }}
    />
  );
}
