import { Linking, StyleSheet, Text } from "react-native";
import { Trans, useTranslation } from "react-i18next";
import { tokens } from "@orya/shared";

type LegalLinksProps = {
  termsUrl: string;
  privacyUrl: string;
};

export function LegalLinks({ termsUrl, privacyUrl }: LegalLinksProps) {
  useTranslation();
  return (
    <Text style={styles.text}>
      <Trans
        i18nKey="auth:legal.text"
        components={{
          terms: (
            <Text
              key="terms"
              style={styles.link}
              accessibilityRole="link"
              onPress={() => Linking.openURL(termsUrl)}
            />
          ),
          privacy: (
            <Text
              key="privacy"
              style={styles.link}
              accessibilityRole="link"
              onPress={() => Linking.openURL(privacyUrl)}
            />
          ),
        }}
      />
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 12,
    color: "rgba(231,238,252,0.76)",
    textAlign: "center",
    lineHeight: 18,
    fontFamily: tokens.typography.fontFamily?.body ?? "System",
  },
  link: {
    color: "rgba(162, 225, 255, 0.96)",
    fontFamily: tokens.typography.fontFamily?.bodyStrong ?? "System",
    textDecorationLine: "underline",
    textDecorationColor: "rgba(162, 225, 255, 0.5)",
  },
});
