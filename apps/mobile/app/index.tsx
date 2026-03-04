import { Redirect } from "expo-router";
import { TAB_PATHNAMES } from "../lib/tabRoutes";

export default function Index() {
  return <Redirect href={TAB_PATHNAMES.inicio} />;
}
