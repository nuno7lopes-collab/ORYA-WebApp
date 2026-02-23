import { Alert, Linking, StyleSheet, Text } from "react-native";
import { Trans, useTranslation } from "react-i18next";
import { tokens } from "@orya/shared";
import { resolveSafeHttpUrl } from "../../lib/externalUrl";

type LegalLinksProps = {
  termsUrl: string;
  privacyUrl: string;
};

export function LegalLinks({ termsUrl, privacyUrl }: LegalLinksProps) {
  useTranslation();
  const openLegalUrl = async (url: string) => {
    const safeUrl = resolveSafeHttpUrl(url);
    if (!safeUrl) {
      Alert.alert("Ligação indisponível", "Não foi possível abrir esta página.");
      return;
    }
    try {
      await Linking.openURL(safeUrl);
    } catch {
      Alert.alert("Ligação indisponível", "Não foi possível abrir esta página.");
    }
  };

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
              onPress={() => {
                void openLegalUrl(termsUrl);
              }}
            />
          ),
          privacy: (
            <Text
              key="privacy"
              style={styles.link}
              accessibilityRole="link"
              onPress={() => {
                void openLegalUrl(privacyUrl);
              }}
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
