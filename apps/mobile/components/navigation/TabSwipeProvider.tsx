import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

type TabSwipeContextValue = {
  isBlocked: boolean;
  block: () => void;
  unblock: () => void;
};

const TabSwipeContext = createContext<TabSwipeContextValue | null>(null);

export function useTabSwipeBlocker() {
  const context = useContext(TabSwipeContext);
  if (!context) {
    throw new Error("useTabSwipeBlocker must be used within TabSwipeProvider");
  }
  return context;
}

export function useScopedTabSwipeBlocker() {
  const { block, unblock, isBlocked } = useTabSwipeBlocker();
  const localCount = useRef(0);

  const blockScoped = useCallback(() => {
    localCount.current += 1;
    block();
  }, [block]);

  const unblockScoped = useCallback(() => {
    if (localCount.current <= 0) return;
    localCount.current -= 1;
    unblock();
  }, [unblock]);

  useEffect(() => {
    return () => {
      if (localCount.current <= 0) return;
      const count = localCount.current;
      localCount.current = 0;
      for (let i = 0; i < count; i += 1) {
        unblock();
      }
    };
  }, [unblock]);

  return { block: blockScoped, unblock: unblockScoped, isBlocked };
}

export function TabSwipeProvider({ children }: { children: ReactNode }) {
  const [blockedCount, setBlockedCount] = useState(0);
  const isBlocked = blockedCount > 0;
  const block = useCallback(() => {
    setBlockedCount((count) => count + 1);
  }, []);
  const unblock = useCallback(() => {
    setBlockedCount((count) => (count > 0 ? count - 1 : 0));
  }, []);

  const contextValue = useMemo(
    () => ({
      isBlocked,
      block,
      unblock,
    }),
    [block, isBlocked, unblock],
  );

  return <TabSwipeContext.Provider value={contextValue}>{children}</TabSwipeContext.Provider>;
}
