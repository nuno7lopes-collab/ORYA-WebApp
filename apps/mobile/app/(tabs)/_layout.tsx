import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0b101a",
          borderTopColor: "rgba(255,255,255,0.08)",
        },
        tabBarActiveTintColor: "#34d399",
        tabBarInactiveTintColor: "#9aa3b2",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Descobrir" }} />
      <Tabs.Screen name="tickets" options={{ title: "Bilhetes" }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
