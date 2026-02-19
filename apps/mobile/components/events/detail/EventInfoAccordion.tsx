import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.header, pressed ? styles.pressed : null]}
      >
        <Text style={styles.title}>{title}</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color="rgba(237,247,255,0.85)"
        />
      </Pressable>
      {description ? (
        <Text style={styles.description} numberOfLines={expanded ? undefined : 3}>
          {description}
        </Text>
      ) : null}
      {expanded && children ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingVertical: 12,
  },
  header: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  pressed: {
    opacity: 0.88,
  },
  title: {
    color: "#F3F9FF",
    fontSize: 16,
    fontWeight: "700",
  },
  description: {
    color: "rgba(227,240,255,0.78)",
    fontSize: 14,
    lineHeight: 20,
  },
  content: {
    gap: 10,
  },
});
