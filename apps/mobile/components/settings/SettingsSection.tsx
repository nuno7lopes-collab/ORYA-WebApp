import { PropsWithChildren } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { SectionHeader } from "../liquid/SectionHeader";
import { tokens } from "@orya/shared";

type SettingsSectionProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}>;

export function SettingsSection({ title, subtitle, children, style }: SettingsSectionProps) {
  return (
    <View style={[{ gap: tokens.spacing.md }, style as ViewStyle]}>
      <SectionHeader title={title} subtitle={subtitle} />
      {children}
    </View>
  );
}
