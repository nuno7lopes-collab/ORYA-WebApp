import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "../../icons/Ionicons";

type EventInfoAccordionProps = PropsWithChildren<{
  expanded: boolean;
  onToggle: () => void;
  description: string | null;
  title?: string;
}>;

export function EventInfoAccordion({
  expanded,
  onToggle,
  description,
  title = "Informação do Evento",
  children,
}: EventInfoAccordionProps) {
  const hasDescription = Boolean(description?.trim());

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {hasDescription ? (
        <View style={styles.descriptionWrap}>
          <Text style={styles.description} numberOfLines={expanded ? undefined : 3}>
            {description}
          </Text>
          {!expanded ? (
            <LinearGradient
              pointerEvents="none"
              colors={[
                "rgba(9,14,21,0)",
                "rgba(9,14,21,0.78)",
                "rgba(9,14,21,0.96)",
              ]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.descriptionFade}
            />
          ) : null}
        </View>
      ) : null}
      {expanded && children ? <View style={styles.content}>{children}</View> : null}
      {hasDescription ? (
        <View style={styles.toggleWrap}>
          <Pressable
            onPress={onToggle}
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityState={{ expanded }}
            style={({ pressed }) => [
              styles.toggleButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={18}
              color="rgba(240,248,255,0.94)"
            />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.88,
  },
  title: {
    color: "#F3F9FF",
    fontSize: 16,
    fontWeight: "700",
  },
  descriptionWrap: {
    position: "relative",
    minHeight: 60,
  },
  description: {
    color: "rgba(227,240,255,0.78)",
    fontSize: 14,
    lineHeight: 20,
  },
  descriptionFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 34,
  },
  content: {
    gap: 10,
  },
  toggleWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  toggleButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(231,244,255,0.24)",
    backgroundColor: "rgba(12,19,28,0.78)",
    alignItems: "center",
    justifyContent: "center",
  },
});
