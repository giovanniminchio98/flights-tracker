import { useEffect, useState } from "react";

/** Ticking "now" for live countdowns. Re-renders on an interval (default 20s
 * — fine for minute-granularity countdowns without wasting cycles). */
export function useNow(intervalMs = 20000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
