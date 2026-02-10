import { PropsWithChildren } from "react";
import { View, type ViewStyle } from "react-native";
import { tokens } from "@orya/shared";

type AppCardProps = PropsWithChildren<{
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}>;

export function AppCard({ children, style, contentStyle }: AppCardProps) {
  return (
    <View
      style={[
        {
          borderRadius: tokens.radius.xl,
          borderWidth: 1,
          borderColor: tokens.colors.border,
          backgroundColor: tokens.colors.surface,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <View
        style={[
          {
            padding: tokens.spacing.lg,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}
