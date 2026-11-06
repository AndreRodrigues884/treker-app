import { useEffect, useState } from 'react';

// The current time, refreshed every `intervalMs` while the screen is shown (for clocks such as the
// workout's elapsed time and the rest timer). What is shown is always computed from timestamps,
// so it is right again as soon as the app comes back from the background.
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
