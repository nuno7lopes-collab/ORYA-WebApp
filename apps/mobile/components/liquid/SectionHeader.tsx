import { View } from "react-native";
import { AppHeading } from "../ui/AppHeading";
import { AppText } from "../ui/AppText";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
};

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <View className="mb-3 gap-1">
      <AppHeading variant="section">{title}</AppHeading>
      {subtitle ? <AppText variant="caption" tone="secondary">{subtitle}</AppText> : null}
    </View>
  );
}
