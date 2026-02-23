declare module "@react-navigation/native" {
  export type NavigationProp<ParamList extends object = Record<string, object | undefined>> = {
    navigate: (...args: unknown[]) => void;
    goBack: () => void;
    canGoBack?: () => boolean;
  };

  export function useNavigation<T = NavigationProp<Record<string, object | undefined>>>(): T;
  export function useFocusEffect(effect: () => void | (() => void) | Promise<void>): void;
  export function useIsFocused(): boolean;
}

declare global {
  namespace ReactNavigation {
    interface RootParamList {
      [key: string]: object | undefined;
    }
  }
}

export {};
