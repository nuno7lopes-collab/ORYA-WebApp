import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "../icons/Ionicons";

export type AuthButtonVariant = "apple" | "google" | "email";

type AuthButtonProps = {
  label: string;
  variant: AuthButtonVariant;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  icon?: ReactNode;
};

const HEIGHT = 54;

const getVariantStyles = (variant: AuthButtonVariant) => {
  switch (variant) {
    case "apple":
      return {
        container: styles.appleContainer,
        text: styles.appleText,
        indicator: "#ffffff",
      } as const;
    case "google":
      return {
        container: styles.googleContainer,
        text: styles.googleText,
        indicator: "#1a1a1a",
      } as const;
    default:
      return {
        container: styles.emailContainer,
        text: styles.emailText,
        indicator: "#cfd6e6",
      } as const;
  }
};

const getDefaultIcon = (variant: AuthButtonVariant) => {
  switch (variant) {
    case "apple":
      return <Ionicons name="logo-apple" size={18} color="#ffffff" />;
    case "google":
      return <Ionicons name="logo-google" size={18} color="#4285F4" />;
    default:
      return null;
  }
};

export function AuthButton({
  label,
  variant,
  onPress,
  loading = false,
  disabled = false,
  accessibilityLabel,
  icon,
}: AuthButtonProps) {
  const stylesForVariant = getVariantStyles(variant);
  const displayIcon = icon ?? getDefaultIcon(variant);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.base,
        stylesForVariant.container,
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
      ]}
    >
      <View style={styles.content}>
        {displayIcon ? <View style={styles.icon}>{displayIcon}</View> : null}
        <Text style={[styles.label, stylesForVariant.text]}>{label}</Text>
        {loading ? (
          <ActivityIndicator size="small" color={stylesForVariant.indicator} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: HEIGHT,
    width: "100%",
    borderRadius: 18,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  icon: {
    width: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
  pressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.6,
  },
  appleContainer: {
    backgroundColor: "#000000",
    borderColor: "rgba(255,255,255,0.15)",
  },
  appleText: {
    color: "#ffffff",
  },
  googleContainer: {
    backgroundColor: "#FFFFFF",
    borderColor: "rgba(15, 23, 42, 0.18)",
    shadowColor: "rgba(0,0,0,0.28)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  googleText: {
    color: "#4285F4",
  },
  emailContainer: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.2)",
  },
  emailText: {
    color: "#e6ebf5",
  },
});
