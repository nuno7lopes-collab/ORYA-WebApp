import { Text, type TextProps } from "react-native";
import { tokens } from "@orya/shared";

type TextVariant = "body" | "caption" | "micro";
type TextTone = "primary" | "secondary" | "tertiary" | "muted";
type TextWeight = "regular" | "strong";

type AppTextProps = TextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  weight?: TextWeight;
};

const toneColors: Record<TextTone, string> = {
  primary: tokens.colors.textPrimary ?? tokens.colors.text,
  secondary: tokens.colors.textSecondary ?? tokens.colors.textSubtle,
  tertiary: tokens.colors.textTertiary ?? tokens.colors.textMuted,
  muted: tokens.colors.textMuted,
};

const variantSizes: Record<TextVariant, number> = {
  body: tokens.typography.body,
  caption: tokens.typography.caption,
  micro: tokens.typography.micro ?? 11,
};

const variantHeights: Record<TextVariant, number> = {
  body: tokens.typography.lineHeight?.body ?? 22,
  caption: tokens.typography.lineHeight?.caption ?? 18,
  micro: tokens.typography.lineHeight?.micro ?? 14,
};

export function AppText({
  variant = "body",
  tone = "primary",
  weight = "regular",
  style,
  ...props
}: AppTextProps) {
  const fontFamily =
    weight === "strong"
      ? tokens.typography.fontFamily?.bodyStrong ?? "System"
      : tokens.typography.fontFamily?.body ?? "System";
  return (
    <Text
      {...props}
      style={[
        {
          color: toneColors[tone],
          fontSize: variantSizes[variant],
          lineHeight: variantHeights[variant],
          fontFamily,
        },
        style,
      ]}
    />
  );
}
