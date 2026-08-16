import { useCallback, useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(mobileBreakpoint = MOBILE_BREAKPOINT) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQuery = window.matchMedia(
        `(max-width: ${mobileBreakpoint - 1}px)`
      );
      mediaQuery.addEventListener("change", onStoreChange);
      return () => mediaQuery.removeEventListener("change", onStoreChange);
    },
    [mobileBreakpoint]
  );
  const getSnapshot = useCallback(
    () => window.innerWidth < mobileBreakpoint,
    [mobileBreakpoint]
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
