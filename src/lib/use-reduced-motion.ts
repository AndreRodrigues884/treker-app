import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// True when the system "reduce motion" setting is on; follows changes while the app runs.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let current = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (current) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      current = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
