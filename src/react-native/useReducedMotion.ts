import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { createReducedMotionStore } from "./reducedMotionStore";

const store = createReducedMotionStore(() => AccessibilityInfo.isReduceMotionEnabled());

store.refresh();

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean | null>(store.get());
  useEffect(() => {
    const unsubscribe = store.subscribe(setReduced);
    const current = store.get();
    if (current !== null) setReduced(current);
    store.refresh();
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", store.set);
    return () => {
      unsubscribe();
      sub.remove();
    };
  }, []);
  return reduced !== false;
}
