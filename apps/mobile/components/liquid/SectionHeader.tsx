import { Text, View } from "react-native";
import { tokens } from "@orya/shared";

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
};

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <View className="mb-3 gap-1">
      <Text className="text-white text-lg font-semibold">{title}</Text>
      {subtitle ? <Text className="text-white/60 text-sm">{subtitle}</Text> : null}
    </View>
  );
}
