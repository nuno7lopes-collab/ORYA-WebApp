import { Image, Linking, Pressable, ScrollView, Text, View, Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "../../lib/supabase";
import { i18n, tokens } from "@orya/shared";
import { GlassSurface } from "../../components/glass/GlassSurface";
import { GlassSkeleton } from "../../components/glass/GlassSkeleton";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { SectionHeader } from "../../components/liquid/SectionHeader";
import { useProfileAgenda, useProfileSummary } from "../../features/profile/hooks";
import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth";

const formatAgendaDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Data a confirmar";
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

const initialFrom = (name?: string | null, email?: string | null): string => {
  const source = name?.trim() || email?.trim() || "?";
  return source.charAt(0).toUpperCase();
};

export default function ProfileScreen() {
  const t = i18n.pt.profile;
  const { session } = useAuth();
  const accessToken = session?.access_token ?? null;
  const summary = useProfileSummary(true, accessToken);
  const agenda = useProfileAgenda(accessToken);
  const [pushStatus, setPushStatus] = useState<
    "loading" | "granted" | "denied" | "undetermined" | "unsupported"
  >("loading");
  const profile = summary.data;
  const agendaData = agenda.data?.items ?? [];
  const agendaStats = agenda.data?.stats ?? { upcoming: 0, past: 0, thisMonth: 0 };
  const upcomingItems = agendaData
    .filter((item) => new Date(item.startAt).getTime() >= Date.now())
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
    .slice(0, 3);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    let mounted = true;
    const resolveStatus = async () => {
      if (Platform.OS !== "ios" || !Constants.isDevice || Constants.appOwnership === "expo") {
        if (mounted) setPushStatus("unsupported");
        return;
      }

      try {
        const Notifications = await import("expo-notifications");
        const status = await Notifications.getPermissionsAsync();
        if (!mounted) return;
        if (status.granted) setPushStatus("granted");
        else if (status.status === "denied") setPushStatus("denied");
        else setPushStatus("undetermined");
      } catch {
        if (mounted) setPushStatus("undetermined");
      }
    };

    resolveStatus();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <LiquidBackground>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 36 }}>
        <Text className="text-white text-[30px] font-semibold mb-2">{t.title}</Text>
        <Text className="text-white/60 text-sm mb-5">Conta, atividade e preferências pessoais.</Text>

        {summary.isLoading ? (
          <View className="gap-3 mb-6">
            <GlassSkeleton height={120} />
            <GlassSkeleton height={90} />
          </View>
        ) : (
          <GlassSurface intensity={58} padding={16} style={{ marginBottom: 20 }}>
            <View className="flex-row gap-4 items-center">
              <View
                className="h-20 w-20 rounded-full border border-white/15 items-center justify-center overflow-hidden"
                style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
              >
                {profile?.avatarUrl ? (
                  <Image
                    source={{ uri: profile.avatarUrl }}
                    resizeMode="cover"
                    style={{ width: 80, height: 80 }}
                  />
                ) : (
                  <Text className="text-white text-2xl font-semibold">
                    {initialFrom(profile?.fullName, profile?.email)}
                  </Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text className="text-white text-xl font-semibold">{profile?.fullName ?? "Utilizador ORYA"}</Text>
                <Text className="text-white/65 text-sm mt-1">
                  {profile?.username ? `@${profile.username}` : "username por definir"}
                </Text>
                {profile?.bio ? (
                  <Text className="text-white/70 text-sm mt-2" numberOfLines={2}>
                    {profile.bio}
                  </Text>
                ) : null}
              </View>
            </View>

            <View className="flex-row gap-2 mt-4">
              <View className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
                <Text className="text-white/75 text-xs">{profile?.city ?? "Cidade a definir"}</Text>
              </View>
              <View className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
                <Text className="text-white/75 text-xs">{profile?.padelLevel ?? "Padel: por definir"}</Text>
              </View>
            </View>
          </GlassSurface>
        )}

        <SectionHeader title="Resumo" subtitle="Atividade recente na tua conta." />
        {agenda.isLoading ? (
          <View className="gap-3 mb-6">
            <GlassSkeleton height={92} />
          </View>
        ) : (
          <GlassSurface intensity={52} padding={16} style={{ marginBottom: 20 }}>
            <View className="flex-row justify-between">
              <View>
                <Text className="text-white/60 text-[11px] uppercase">Próximos</Text>
                <Text className="text-white text-2xl font-semibold mt-1">{agendaStats.upcoming}</Text>
              </View>
              <View>
                <Text className="text-white/60 text-[11px] uppercase">Histórico</Text>
                <Text className="text-white text-2xl font-semibold mt-1">{agendaStats.past}</Text>
              </View>
              <View>
                <Text className="text-white/60 text-[11px] uppercase">Mês</Text>
                <Text className="text-white text-2xl font-semibold mt-1">{agendaStats.thisMonth}</Text>
              </View>
            </View>
          </GlassSurface>
        )}

        <SectionHeader title="Próximos momentos" subtitle="Os teus próximos eventos e inscrições." />
        <View className="gap-3 mb-6">
          {agenda.isLoading ? (
            <>
              <GlassSkeleton height={74} />
              <GlassSkeleton height={74} />
            </>
          ) : upcomingItems.length > 0 ? (
            upcomingItems.map((item) => (
              <GlassSurface key={item.id} intensity={48} padding={14}>
                <Text className="text-white font-semibold text-sm" numberOfLines={1}>
                  {item.title}
                </Text>
                <Text className="text-white/65 text-xs mt-1">{formatAgendaDate(item.startAt)}</Text>
                {item.label ? (
                  <Text className="text-white/55 text-xs mt-2 uppercase">{item.label}</Text>
                ) : null}
              </GlassSurface>
            ))
          ) : (
            <GlassSurface intensity={45} padding={14}>
              <Text className="text-white/65 text-sm">Ainda sem próximos momentos na agenda.</Text>
            </GlassSurface>
          )}
        </View>

        <SectionHeader title="Conta" />
        <GlassSurface intensity={50} padding={16}>
          <Text className="text-white/75 text-sm">Email</Text>
          <Text className="text-white text-base font-semibold mt-1">{profile?.email ?? "-"}</Text>
        </GlassSurface>

        <View className="mt-6">
          <SectionHeader title="Notificações" subtitle="Lembra-te de ativares para não perderes eventos." />
          <GlassSurface intensity={52} padding={16}>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-white/70 text-sm">Estado</Text>
                <Text className="text-white text-base font-semibold mt-1">
                {pushStatus === "loading"
                  ? "A verificar…"
                  : pushStatus === "granted"
                    ? "Ativas"
                    : pushStatus === "denied"
                      ? "Bloqueadas"
                      : pushStatus === "unsupported"
                        ? "Indisponível no Expo Go"
                        : "Por ativar"}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                if (pushStatus === "unsupported") {
                  return;
                }
                if (pushStatus === "granted") {
                  Linking.openSettings();
                  return;
                }
                import("expo-notifications").then((Notifications) => {
                  Notifications.requestPermissionsAsync().then((status) => {
                    if (status.granted) setPushStatus("granted");
                    else if (status.status === "denied") setPushStatus("denied");
                    else setPushStatus("undetermined");
                  });
                });
              }}
              className="rounded-full border border-white/10 bg-white/10 px-4 py-2"
              style={{ minHeight: tokens.layout.touchTarget }}
            >
              <Text className="text-white text-sm font-semibold">
                {pushStatus === "unsupported"
                  ? "Requer build"
                  : pushStatus === "granted"
                    ? "Abrir definições"
                    : "Ativar"}
              </Text>
            </Pressable>
          </View>
            <Text className="text-white/55 text-xs mt-3">
              Enviamos lembretes de eventos, cancelamentos e updates importantes (incl. padel T-48/T-24).
            </Text>
          </GlassSurface>
        </View>

        <View className="mt-6">
          <SectionHeader title="Segurança" />
          <GlassSurface intensity={48} padding={16}>
            <Text className="text-white/70 text-sm">
              Sessões e segurança avançada continuam no web admin e no roadmap mobile.
            </Text>
          </GlassSurface>
        </View>

        {summary.isError || agenda.isError ? (
          <GlassSurface intensity={45} padding={14} style={{ marginTop: 16 }}>
            <Text className="text-red-300 text-sm mb-3">Falha ao atualizar dados do perfil.</Text>
            <Pressable
              className="rounded-xl bg-white/10 px-4 py-3"
              onPress={() => {
                summary.refetch();
                agenda.refetch();
              }}
              style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
            >
              <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
            </Pressable>
          </GlassSurface>
        ) : null}

        <Pressable
          className="mt-6 rounded-2xl bg-white/10 px-4 py-3 items-center border border-white/15"
          onPress={signOut}
          style={{ minHeight: tokens.layout.touchTarget, justifyContent: "center" }}
        >
          <Text className="text-white font-semibold">Sair</Text>
        </Pressable>
      </ScrollView>
    </LiquidBackground>
  );
}
