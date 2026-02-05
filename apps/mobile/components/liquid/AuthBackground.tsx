import { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { LiquidBackground } from "./LiquidBackground";

export function AuthBackground({ children }: PropsWithChildren) {
  return (
    <LiquidBackground variant="deep">
      <View style={styles.backgroundLayer} pointerEvents="none">
        <LinearGradient
          colors={["rgba(40, 60, 120, 0.28)", "transparent"]}
          start={{ x: 0.1, y: 0.1 }}
          end={{ x: 0.9, y: 0.9 }}
          style={styles.nebulaOne}
        />
        <LinearGradient
          colors={["rgba(90, 120, 200, 0.22)", "transparent"]}
          start={{ x: 0.2, y: 0.2 }}
          end={{ x: 1, y: 1 }}
          style={styles.nebulaTwo}
        />
        <LinearGradient
          colors={["rgba(255,255,255,0.04)", "transparent"]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {children}
    </LiquidBackground>
  );
}

const styles = StyleSheet.create({
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  nebulaOne: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    top: -80,
    right: -120,
  },
  nebulaTwo: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    bottom: -120,
    left: -140,
  },
});
