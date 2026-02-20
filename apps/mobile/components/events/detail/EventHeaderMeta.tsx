import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AvatarCircle } from "../../avatar/AvatarCircle";

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
              <AvatarCircle
                size={48}
                uri={organizer?.avatarUri ?? null}
                iconName="business"
                borderColor="rgba(220,240,255,0.36)"
                borderWidth={1}
                ringColors={["#FF73DF", "#6BFFFF", "#6B7BFF"]}
              />
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
    minHeight: 84,
    marginTop: 26,
    paddingRight: 8,
  },
  organizerLabel: {
    color: "rgba(229,241,255,0.72)",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.2,
    marginBottom: 20,
  },
  organizerProfileRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  organizerAvatar: {
    width: 48,
    height: 48,
  },
  organizerTextWrap: {
    flex: 1,
    gap: 5,
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
