import { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LiquidBackground } from "../../components/liquid/LiquidBackground";
import { GlassCard } from "../../components/liquid/GlassCard";
import { TopAppHeader } from "../../components/navigation/TopAppHeader";
import { useTopHeaderPadding } from "../../components/navigation/useTopHeaderPadding";
import { useTabBarPadding } from "../../components/navigation/useTabBarPadding";
import { Ionicons } from "../../components/icons/Ionicons";
import { AvatarCircle } from "../../components/avatar/AvatarCircle";
import { fetchOrganizationInvites, respondOrganizationInvite } from "../../features/notifications/api";
import type { OrganizationInvite } from "../../features/notifications/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { safeBack } from "../../lib/navigation";
import { tokens } from "@orya/shared";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "owner",
  CO_OWNER: "co-owner",
  ADMIN: "admin",
  STAFF: "staff",
  TRAINER: "treinador",
  PROMOTER: "promotor",
  VIEWER: "membro",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  ACCEPTED: "Aceite",
  DECLINED: "Recusado",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
};

const formatRoleLabel = (role?: string | null) => {
  if (!role) return "membro";
  return ROLE_LABELS[role] ?? role.toLowerCase();
};

const formatInvitedBy = (invite: OrganizationInvite) => {
  const inviter = invite.invitedBy;
  if (!inviter) return "Equipa ORYA";
  return inviter.fullName || inviter.username || "Equipa ORYA";
};

const formatOrgName = (invite: OrganizationInvite) => {
  return invite.organization?.publicName || invite.organization?.businessName || "Organização";
};

export default function OrganizationInvitesScreen() {
  const topPadding = useTopHeaderPadding(12);
  const tabBarPadding = useTabBarPadding();
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ source?: string }>();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const source = useMemo(() => {
    const raw = params.source;
    if (Array.isArray(raw)) return raw[0] ?? null;
    if (typeof raw === "string" && raw.trim().length > 0) return raw;
    return null;
  }, [params.source]);
  const fallbackRoute = source === "notifications" ? "/notifications" : "/(tabs)";

  const invitesQuery = useQuery({
    queryKey: ["org-invites"],
    queryFn: fetchOrganizationInvites,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });

  const invites = useMemo(() => invitesQuery.data ?? [], [invitesQuery.data]);

  const handleRespond = useCallback(
    async (inviteId: string, action: "ACCEPT" | "DECLINE") => {
      if (pendingId) return;
      setPendingId(inviteId);
      try {
        await respondOrganizationInvite(inviteId, action);
        await queryClient.invalidateQueries({ queryKey: ["org-invites"] });
      } catch {
        Alert.alert("Não foi possível", "Tenta novamente.");
      } finally {
        setPendingId(null);
      }
    },
    [pendingId, queryClient],
  );

  const renderInvite = useCallback(
    ({ item }: { item: OrganizationInvite }) => {
      const orgName = formatOrgName(item);
      const invitedBy = formatInvitedBy(item);
      const roleLabel = formatRoleLabel(item.role);
      const statusLabel = STATUS_LABELS[item.status] ?? item.status;
      const canRespond = item.status === "PENDING" && item.canRespond !== false;
      const avatarUrl = item.organization?.brandingAvatarUrl || item.invitedBy?.avatarUrl || null;
      const coverUrl = item.organization?.brandingCoverUrl || null;
      const orgUsername = item.organization?.username ?? null;
      const expiresLabel = item.expiresAt
        ? new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(new Date(item.expiresAt))
        : null;

      return (
        <GlassCard intensity={60} padding={0} style={{ marginBottom: 12, overflow: "hidden" }}>
          <View style={styles.cover}>
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <View style={styles.coverFallback} />
            )}
          </View>
          <View style={{ flexDirection: "row", gap: 12, padding: 14, paddingTop: 0, alignItems: "center" }}>
            <Pressable
              onPress={() => {
                if (orgUsername) {
                  router.push({ pathname: "/[username]", params: { username: orgUsername } });
                }
              }}
              disabled={!orgUsername}
              style={{ marginTop: -22 }}
              accessibilityRole="button"
              accessibilityLabel={`Abrir organização ${orgName}`}
              accessibilityState={{ disabled: !orgUsername }}
            >
              <AvatarCircle
                size={52}
                uri={avatarUrl}
                iconName="business"
                borderWidth={2}
                borderColor="rgba(10,14,24,0.95)"
              />
            </Pressable>
            <View style={{ flex: 1, gap: 6 }}>
              <Pressable
                onPress={() => {
                  if (orgUsername) {
                    router.push({ pathname: "/[username]", params: { username: orgUsername } });
                  }
                }}
                disabled={!orgUsername}
                style={{ alignSelf: "flex-start" }}
                accessibilityRole="button"
                accessibilityLabel={`Abrir organização ${orgName}`}
                accessibilityState={{ disabled: !orgUsername }}
              >
                <Text className="text-white text-sm font-semibold">{orgName}</Text>
              </Pressable>
              <Text className="text-white/70 text-xs">
                Convidou-te para seres {roleLabel}. · {invitedBy}
              </Text>
              {expiresLabel ? (
                <Text className="text-white/45 text-[11px]">Expira em {expiresLabel}</Text>
              ) : null}
              {canRespond ? (
                <View style={styles.actionsRow}>
                  <Pressable
                    onPress={() => handleRespond(item.id, "DECLINE")}
                    disabled={pendingId === item.id}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.actionSecondary,
                      pressed && styles.actionPressed,
                      pendingId === item.id && styles.actionDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Recusar convite"
                    accessibilityState={{ disabled: pendingId === item.id }}
                  >
                    <Text style={[styles.actionText, styles.actionTextSecondary]}>Recusar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRespond(item.id, "ACCEPT")}
                    disabled={pendingId === item.id}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.actionPrimary,
                      pressed && styles.actionPressed,
                      pendingId === item.id && styles.actionDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Aceitar convite"
                    accessibilityState={{ disabled: pendingId === item.id }}
                  >
                    <Text style={[styles.actionText, styles.actionTextPrimary]}>Aceitar</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{statusLabel}</Text>
                </View>
              )}
            </View>
          </View>
        </GlassCard>
      );
    },
    [handleRespond, pendingId],
  );

  return (
    <LiquidBackground variant="solid">
      <TopAppHeader />
      <View style={{ flex: 1, paddingTop: topPadding, paddingHorizontal: 20, paddingBottom: tabBarPadding }}>
        <Pressable
          onPress={() => safeBack(router, navigation, fallbackRoute)}
          className="flex-row items-center gap-2 mb-3"
          style={{ minHeight: tokens.layout.touchTarget }}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.9)" />
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 14, fontWeight: "600" }}>Voltar</Text>
        </Pressable>
        <View style={{ marginBottom: 14 }}>
          <Text className="text-white text-2xl font-semibold">Convites de organização</Text>
          <Text className="text-white/60 text-sm">Aceita ou recusa convites pendentes.</Text>
        </View>

        {invitesQuery.isError ? (
          <GlassCard intensity={55} style={{ padding: 16 }}>
            <Ionicons name="alert-circle" size={20} color="rgba(255,160,160,0.9)" />
            <Text className="text-white/80 text-sm mt-2">Não foi possível carregar.</Text>
            <Pressable
              onPress={() => invitesQuery.refetch()}
              className="mt-3 rounded-2xl bg-white/10 px-4 py-3"
              accessibilityRole="button"
              accessibilityLabel="Tentar novamente"
            >
              <Text className="text-white text-sm font-semibold text-center">Tentar novamente</Text>
            </Pressable>
          </GlassCard>
        ) : invitesQuery.isLoading ? (
          <GlassCard intensity={50} style={{ padding: 16 }}>
            <Text className="text-white/70 text-sm">A carregar convites…</Text>
          </GlassCard>
        ) : invites.length === 0 ? (
          <GlassCard intensity={50} style={{ padding: 16 }}>
            <Text className="text-white/70 text-sm">Sem convites pendentes.</Text>
          </GlassCard>
        ) : (
          <FlatList
            data={invites}
            keyExtractor={(item) => item.id}
            renderItem={renderInvite}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </LiquidBackground>
  );
}

const styles = {
  actionsRow: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center" as const,
  },
  actionPrimary: {
    backgroundColor: "#3897F0",
    borderColor: "#3897F0",
    shadowColor: "#3897F0",
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  actionSecondary: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  actionPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  actionTextPrimary: {
    color: "#ffffff",
  },
  actionTextSecondary: {
    color: "rgba(235,245,255,0.9)",
  },
  statusPill: {
    alignSelf: "flex-start" as const,
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: {
    color: "rgba(235,245,255,0.85)",
    fontSize: 12,
    fontWeight: "600" as const,
  },
  cover: {
    height: 110,
    width: "100%" as const,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  coverFallback: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
};
