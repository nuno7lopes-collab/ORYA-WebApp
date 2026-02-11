import type { ReactElement } from "react";
import { FlatList, UIManager } from "react-native";
import { FlashList, type FlashListProps } from "@shopify/flash-list";

const hasAutoLayoutView = Boolean(UIManager.getViewManagerConfig?.("AutoLayoutView"));

export const SafeFlashList = <T,>(props: FlashListProps<T>): ReactElement => {
  if (hasAutoLayoutView) {
    return <FlashList {...props} />;
  }

  const { estimatedItemSize: _estimatedItemSize, ...rest } = props as FlashListProps<T> & {
    estimatedItemSize?: number;
  };

  return <FlatList {...rest} />;
};

export default SafeFlashList;
