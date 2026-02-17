import type { ReactElement } from "react";
import { FlatList, Platform, UIManager, type FlatListProps } from "react-native";
import { FlashList, type FlashListProps } from "@shopify/flash-list";

const hasAutoLayoutView = Boolean(UIManager.getViewManagerConfig?.("AutoLayoutView"));
const shouldUseFlashList = hasAutoLayoutView && Platform.OS !== "web";

type SafeFlashListProps<T> = FlatListProps<T> & {
  estimatedItemSize?: number;
};

export const SafeFlashList = <T,>(props: SafeFlashListProps<T>): ReactElement => {
  if (shouldUseFlashList) {
    return <FlashList {...(props as unknown as FlashListProps<T>)} />;
  }

  const { estimatedItemSize: _estimatedItemSize, ...rest } = props;

  return <FlatList {...rest} />;
};

export default SafeFlashList;
