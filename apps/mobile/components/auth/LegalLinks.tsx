import { Linking, StyleSheet, Text } from "react-native";

type LegalLinksProps = {
  termsUrl: string;
  privacyUrl: string;
};

export function LegalLinks({ termsUrl, privacyUrl }: LegalLinksProps) {
  return (
    <Text style={styles.text}>
      Ao continuar, aceitas os{" "}
      <Text
        style={styles.link}
        accessibilityRole="link"
        onPress={() => Linking.openURL(termsUrl)}
      >
        Termos
      </Text>
      {" "}e a{" "}
      <Text
        style={styles.link}
        accessibilityRole="link"
        onPress={() => Linking.openURL(privacyUrl)}
      >
        Política de Privacidade
      </Text>
      .
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
