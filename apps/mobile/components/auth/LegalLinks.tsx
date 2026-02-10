import { Linking, StyleSheet, Text } from "react-native";
import { Trans, useTranslation } from "react-i18next";

type LegalLinksProps = {
  termsUrl: string;
  privacyUrl: string;
};

export function LegalLinks({ termsUrl, privacyUrl }: LegalLinksProps) {
  useTranslation();
  return (
    <Text style={styles.text}>
      <Trans
        i18nKey="auth.legal.text"
        components={{
          terms: (
            <Text
              style={styles.link}
              accessibilityRole="link"
              onPress={() => Linking.openURL(termsUrl)}
            />
          ),
          privacy: (
            <Text
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
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 18,
  },
  link: {
    color: "rgba(148, 214, 255, 0.95)",
    fontWeight: "600",
  },
});
