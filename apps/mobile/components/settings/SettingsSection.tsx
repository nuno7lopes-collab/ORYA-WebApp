import { PropsWithChildren } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { GlassCard } from "../liquid/GlassCard";
import { SectionHeader } from "../liquid/SectionHeader";
import { tokens } from "@orya/shared";

type SettingsSectionProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}>;

export function SettingsSection({ title, subtitle, children, style }: SettingsSectionProps) {
  return (
    <GlassCard
      padding={tokens.spacing.lg}
      style={style as ViewStyle}
      contentStyle={{ gap: tokens.spacing.md }}
    >
      <SectionHeader title={title} subtitle={subtitle} />
      {children}
    </GlassCard>
  );
}
