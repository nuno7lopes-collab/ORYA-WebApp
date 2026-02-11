import { memo } from "react";
import { Link } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ImageBackground, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "../../components/icons/Ionicons";
import { tokens } from "@orya/shared";
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

const formatDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    return ENTITLEMENT_DATE_FORMATTER.format(new Date(value));
  } catch {
    return null;
  }
};

const statusLabel = (value: string, consumedAt?: string | null) => {
  if (consumedAt) return "Usado";
  const normalized = value.toUpperCase();
  if (normalized === "ACTIVE") return "Ativo";
  if (normalized === "PENDING") return "Pendente";
  if (normalized === "REVOKED") return "Revogado";
  if (normalized === "SUSPENDED") return "Suspenso";
  if (normalized === "CHARGEBACK_LOST") return "Chargeback";
  if (normalized === "EXPIRED") return "Expirado";
  if (normalized === "CANCELLED") return "Cancelado";
  return value;
};

const typeLabel = (value: string) => {
  const normalized = value.toUpperCase();
  if (normalized === "EVENT_TICKET" || normalized === "TICKET") return "Bilhete";
  if (normalized === "PADEL_ENTRY" || normalized === "REGISTRATION") return "Inscrição";
  if (normalized === "SERVICE_BOOKING" || normalized === "BOOKING") return "Reserva";
  return value;
};

export const WalletEntitlementCard = memo(function WalletEntitlementCard({ item }: Props) {
  const coverUrl = item.snapshot.coverUrl;
  const title = item.snapshot.title ?? typeLabel(item.type);
  const venue = item.snapshot.venueName ?? null;
  const dateLabel = formatDate(item.snapshot.startAt);
  const canShowQr = Boolean(item.actions?.canShowQr && item.qrToken && !item.consumedAt);
  const passAvailable = Platform.OS === "ios" && Boolean(item.passAvailable);
  const status = statusLabel(item.status, item.consumedAt);
  const normalizedStatus = item.status?.toUpperCase?.() ?? "";
  const isActive = canShowQr || normalizedStatus === "ACTIVE";
  const showStatus = status !== "Ativo";

  return (
    <Link href={{ pathname: "/wallet/[entitlementId]", params: { entitlementId: item.entitlementId } }} asChild push>
      <Pressable
        android_ripple={{ color: "rgba(255,255,255,0.08)" }}
        accessibilityRole="button"
        accessibilityLabel={`Abrir bilhete ${title}`}
      >
        <View style={styles.cardWrap}>
          <View style={[styles.card, isActive ? styles.cardActive : null]}>
            <View style={styles.coverWrap}>
              {coverUrl ? (
                <ImageBackground source={{ uri: coverUrl }} resizeMode="cover" style={styles.cover}>
                  <LinearGradient
                    colors={["rgba(5,8,14,0.12)", "rgba(2,4,10,0.82)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.coverGradient}
                  />
                </ImageBackground>
              ) : (
                <View style={[styles.cover, styles.coverFallback]}>
                </View>
              )}
            </View>

            <View style={styles.perfRow}>
              <View style={styles.perfLine} />
              <View style={[styles.perfNotch, styles.perfNotchLeft]} />
              <View style={[styles.perfNotch, styles.perfNotchRight]} />
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoMain}>
                <View style={styles.metaRow}>
                  <Text style={styles.typeLabel}>{typeLabel(item.type)}</Text>
                  {showStatus ? (
                    <View style={styles.statusPill}>
                      <Text style={styles.statusText}>{status}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.title} numberOfLines={2}>
                  {title}
                </Text>
                {venue ? <Text style={styles.venue}>{venue}</Text> : null}
                {dateLabel ? <Text style={styles.date}>{dateLabel}</Text> : null}
                {canShowQr ? (
                  <View style={styles.qrRow}>
                    <Ionicons name="qr-code-outline" size={14} color="rgba(255,255,255,0.7)" />
                    <Text style={styles.qrText}>QR disponível</Text>
                    {passAvailable ? <Text style={styles.qrMuted}>Wallet</Text> : null}
                  </View>
                ) : null}
              </View>
              <View style={styles.stub}>
                <View style={styles.stubDivider} />
                <Text style={styles.stubBrand}>ORYA</Text>
                <Ionicons name="ticket-outline" size={18} color="rgba(255,255,255,0.85)" />
                <Text style={styles.stubCount}>1</Text>
              </View>
            </View>
          </View>
        </View>
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
  cardWrap: {
    marginBottom: 16,
  },
  card: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(11,16,22,0.85)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cardActive: {
    borderColor: "rgba(255,255,255,0.24)",
  },
  coverWrap: {
    overflow: "hidden",
  },
  cover: {
    height: 180,
    justifyContent: "flex-end",
  },
  coverFallback: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  perfRow: {
    height: 18,
    justifyContent: "center",
    backgroundColor: "rgba(8,11,16,0.92)",
  },
  perfLine: {
    marginHorizontal: 22,
    borderTopWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.18)",
  },
  perfNotch: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: tokens.colors.background,
  },
  perfNotchLeft: {
    left: -9,
  },
  perfNotchRight: {
    right: -9,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "rgba(8,11,16,0.92)",
  },
  infoMain: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  typeLabel: {
    color: "rgba(235,240,248,0.55)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.4,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  statusText: {
    color: "rgba(235,240,248,0.8)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  title: {
    color: "white",
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  venue: {
    color: "rgba(230,235,245,0.82)",
    fontSize: 14,
    fontWeight: "500",
  },
  date: {
    color: "rgba(200,210,225,0.75)",
    fontSize: 13,
  },
  qrRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  qrText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "500",
  },
  qrMuted: {
    color: "rgba(210,215,225,0.6)",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 6,
  },
  stub: {
    width: 70,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 6,
  },
  stubDivider: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 1,
    borderRightWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.18)",
  },
  stubBrand: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  stubCount: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    fontWeight: "700",
  },
});
