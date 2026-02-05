import { memo } from "react";
import { Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ImageBackground, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "../../components/icons/Ionicons";
import { tokens } from "@orya/shared";
import { GlassCard } from "../../components/liquid/GlassCard";
import { GlassPill } from "../../components/liquid/GlassPill";
import { WalletEntitlement } from "./types";

type Props = {
  item: WalletEntitlement;
};

const ENTITLEMENT_DATE_FORMATTER = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Data por anunciar";
  try {
    return ENTITLEMENT_DATE_FORMATTER.format(new Date(value));
  } catch {
    return "Data por anunciar";
  }
};

const statusLabel = (value: string) => {
  const normalized = value.toUpperCase();
  if (normalized === "ACTIVE") return "Ativo";
  if (normalized === "USED") return "Usado";
  if (normalized === "CANCELLED") return "Cancelado";
  if (normalized === "EXPIRED") return "Expirado";
  return value;
};

const typeLabel = (value: string) => {
  const normalized = value.toUpperCase();
  if (normalized === "TICKET") return "Bilhete";
  if (normalized === "REGISTRATION") return "Inscrição";
  if (normalized === "BOOKING") return "Reserva";
  return value;
};

export const WalletEntitlementCard = memo(function WalletEntitlementCard({ item }: Props) {
  const coverUrl = item.snapshot.coverUrl;
  const title = item.snapshot.title ?? "Entitlement";
  const venue = item.snapshot.venueName ?? "Local a anunciar";
  const dateLabel = formatDate(item.snapshot.startAt);
  const canShowQr = Boolean(item.actions?.canShowQr && item.qrToken);
  const passAvailable = Platform.OS === "ios" && Boolean(item.passAvailable);

  return (
    <Link href={{ pathname: "/wallet/[entitlementId]", params: { entitlementId: item.entitlementId } }} asChild push>
      <Pressable android_ripple={{ color: "rgba(255,255,255,0.08)" }}>
        <GlassCard className="mb-4" intensity={58} padding={tokens.spacing.md} highlight={canShowQr}>
          <View className="gap-3">
            <View className="overflow-hidden rounded-2xl border border-white/10">
              {coverUrl ? (
                <ImageBackground source={{ uri: coverUrl }} resizeMode="cover" style={{ height: 146, justifyContent: "space-between" }}>
                  <LinearGradient
                    colors={["rgba(0,0,0,0.04)", "rgba(0,0,0,0.68)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.coverGradient}
                  />
                  <View className="px-3 pt-3 flex-row items-center justify-between">
                    <GlassPill label={typeLabel(item.type)} />
                    <GlassPill label={statusLabel(item.status)} variant="muted" />
                  </View>
                  <View className="px-3 pb-3">
                    <Text className="text-white text-base font-semibold" numberOfLines={2}>
                      {title}
                    </Text>
                  </View>
                </ImageBackground>
              ) : (
                <View
                  style={{
                    height: 146,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    justifyContent: "space-between",
                    paddingHorizontal: tokens.spacing.md,
                    paddingVertical: tokens.spacing.md,
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <GlassPill label={typeLabel(item.type)} />
                    <GlassPill label={statusLabel(item.status)} variant="muted" />
                  </View>
                  <Text className="text-white text-base font-semibold" numberOfLines={2}>
                    {title}
                  </Text>
                </View>
              )}
            </View>

            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.65)" />
                <Text className="text-white/70 text-xs">{dateLabel}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.6)" />
                <Text className="text-white/65 text-xs">{venue}</Text>
              </View>
              <View className="flex-row items-center justify-between pt-1">
                {canShowQr ? (
                  <View className="flex-row items-center gap-2">
                    <GlassPill label="QR pronto" variant="accent" />
                    {passAvailable ? <GlassPill label="Wallet" variant="muted" /> : null}
                  </View>
                ) : (
                  <Text className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                    Sem QR
                  </Text>
                )}
                <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.45)" />
              </View>
            </View>
          </View>
        </GlassCard>
      </Pressable>
    </Link>
  );
});

const styles = StyleSheet.create({
  coverGradient: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
