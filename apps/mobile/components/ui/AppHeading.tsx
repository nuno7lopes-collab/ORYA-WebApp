import { Text, type TextProps } from "react-native";
import { tokens } from "@orya/shared";

type HeadingVariant = "display" | "title" | "section";

type AppHeadingProps = TextProps & {
  variant?: HeadingVariant;
};

const variantSizes: Record<HeadingVariant, number> = {
  display: tokens.typography.display ?? 34,
  title: tokens.typography.title,
  section: tokens.typography.section,
};

const variantHeights: Record<HeadingVariant, number> = {
  display: tokens.typography.lineHeight?.display ?? 40,
  title: tokens.typography.lineHeight?.title ?? 36,
  section: tokens.typography.lineHeight?.section ?? 26,
};

export function AppHeading({ variant = "title", style, ...props }: AppHeadingProps) {
  const fontFamily = tokens.typography.fontFamily?.heading ?? "System";
  return (
    <Text
      {...props}
      style={[
        {
          color: tokens.colors.textPrimary ?? tokens.colors.text,
          fontSize: variantSizes[variant],
          lineHeight: variantHeights[variant],
          fontFamily,
        },
        style,
      ]}
    />
  );
}
