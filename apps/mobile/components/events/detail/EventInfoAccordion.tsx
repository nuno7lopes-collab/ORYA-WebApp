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
              colors={["rgba(9,14,21,0)", "rgba(9,14,21,0.78)", "rgba(9,14,21,0.96)"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.descriptionFade}
            />
          ) : null}
        </View>
      ) : null}
      {expanded && children ? <View style={styles.content}>{children}</View> : null}
      {hasDescription ? (
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ expanded }}
          style={({ pressed }) => [styles.toggleButton, pressed ? styles.pressed : null]}
        >
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(255,255,255,0.12)", "rgba(16,24,33,0.72)"]}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.7, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.toggleHighlight} />
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={18}
            color="rgba(240,248,255,0.94)"
          />
        </Pressable>
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
    height: 28,
  },
  content: {
    gap: 10,
  },
  toggleButton: {
    alignSelf: "center",
    width: 38,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "rgba(231,244,255,0.28)",
    backgroundColor: "rgba(15,22,31,0.72)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  toggleHighlight: {
    position: "absolute",
    left: 1.5,
    right: 1.5,
    top: 1.5,
    height: 10,
    borderRadius: 8,
    backgroundColor: "rgba(241,248,255,0.14)",
  },
});
