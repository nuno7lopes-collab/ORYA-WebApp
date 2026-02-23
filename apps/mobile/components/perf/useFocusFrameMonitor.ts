import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { startFrameMonitor } from "../../lib/perf";

export function useFocusFrameMonitor(label: string, sampleWindowMs = 4000) {
  useFocusEffect(
    useCallback(() => {
      if (!__DEV__) return () => undefined;
      const stop = startFrameMonitor(label, { sampleWindowMs });
      return () => {
        stop();
      };
    }, [label, sampleWindowMs]),
  );
}

