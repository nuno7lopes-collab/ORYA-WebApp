import { Image } from "expo-image";
import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type OrganizerMeta = {
  name: string | null;
  username: string | null;
  avatarUri?: string | null;
  onPress?: () => void;
  disabled?: boolean;
};

type EventHeaderMetaProps = PropsWithChildren<{
  title: string | null;
  dateLabel: string | null;
  locationLabel: string | null;
  organizer?: OrganizerMeta | null;
}>;

const resolveInitials = (name: string | null, username: string | null) => {
  const safeName = name?.trim() ?? "";
  if (safeName) {
    const chunks = safeName.split(/\s+/).filter(Boolean);
    const initials = chunks
      .slice(0, 2)
      .map((chunk) => chunk.slice(0, 1).toUpperCase())
      .join("");
    if (initials) return initials;
  }
  const safeUsername = username?.replace(/^@+/, "").trim() ?? "";
  return safeUsername ? safeUsername.slice(0, 2).toUpperCase() : "OR";
};

export function EventHeaderMeta({
  title,
  dateLabel,
  locationLabel,
  organizer,
  children,
}: EventHeaderMetaProps) {
  const organizerName = organizer?.name?.trim() || null;
  const organizerUsername = organizer?.username?.replace(/^@+/, "").trim() || null;
  const showOrganizer = Boolean(organizerName || organizerUsername);
  const organizerPrimary = organizerName || (organizerUsername ? `@${organizerUsername}` : null);
  const organizerSecondary =
    organizerName && organizerUsername ? `@${organizerUsername}` : null;
  const avatarInitials = resolveInitials(organizerName, organizerUsername);

  return (
    <View style={styles.container}>
      {title ? (
        <Text style={styles.title} numberOfLines={3}>
          {title}
        </Text>
      ) : null}
      {dateLabel ? (
        <Text style={styles.date} numberOfLines={1}>
          {dateLabel}
        </Text>
      ) : null}
      {locationLabel ? (
        <Text style={styles.location} numberOfLines={2}>
          {locationLabel}
        </Text>
      ) : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
      {showOrganizer ? (
        <Pressable
          onPress={organizer?.onPress}
          disabled={organizer?.disabled}
          accessibilityRole="button"
          accessibilityLabel={organizerPrimary ?? "Abrir organizador"}
          accessibilityState={{ disabled: organizer?.disabled }}
          style={({ pressed }) => [
            styles.organizerRow,
            pressed && !organizer?.disabled ? styles.pressed : null,
          ]}
        >
          <Text style={styles.organizerLabel} numberOfLines={1}>
            Organizado por:
          </Text>
          <View style={styles.organizerProfileRow}>
            <View style={styles.organizerAvatar}>
              {organizer?.avatarUri ? (
                <Image
                  source={{ uri: organizer.avatarUri }}
                  style={styles.organizerAvatarImage}
                  contentFit="cover"
                  transition={160}
                />
              ) : (
                <Text style={styles.organizerAvatarInitials}>{avatarInitials}</Text>
              )}
            </View>
            <View style={styles.organizerTextWrap}>
              {organizerPrimary ? (
                <Text style={styles.organizerPrimary} numberOfLines={1}>
                  {organizerPrimary}
                </Text>
              ) : null}
              {organizerSecondary ? (
                <Text style={styles.organizerSecondary} numberOfLines={1}>
                  {organizerSecondary}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    paddingTop: 14,
  },
  title: {
    color: "#F4F9FF",
    fontSize: 46 / 2,
    lineHeight: 58 / 2,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  date: {
    color: "#6BFFFF",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  location: {
    color: "rgba(238,246,255,0.88)",
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 8,
  },
  organizerRow: {
    minHeight: 78,
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.025)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  organizerLabel: {
    color: "rgba(229,241,255,0.72)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.36,
  },
  organizerProfileRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  organizerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "rgba(220,240,255,0.36)",
    backgroundColor: "rgba(140,196,255,0.26)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  organizerAvatarImage: {
    width: "100%",
    height: "100%",
  },
  organizerAvatarInitials: {
    color: "#EFF7FF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  organizerTextWrap: {
    flex: 1,
    gap: 4,
  },
  organizerPrimary: {
    color: "#F3F9FF",
    fontSize: 14,
    fontWeight: "700",
  },
  organizerSecondary: {
    color: "rgba(227,242,255,0.66)",
    fontSize: 12,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.9,
  },
});
