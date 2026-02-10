import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOP_APP_HEADER_HEIGHT } from "./topBarTokens";

export const useTopHeaderPadding = (extra = 16) => {
  const insets = useSafeAreaInsets();
  return insets.top + TOP_APP_HEADER_HEIGHT + extra;
};
