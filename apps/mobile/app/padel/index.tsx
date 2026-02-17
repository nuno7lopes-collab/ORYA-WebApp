import { Redirect } from "expo-router";

export default function PadelRedirectScreen() {
  return <Redirect href={{ pathname: "/(tabs)/index", params: { world: "padel" } }} />;
}
