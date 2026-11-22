import { useState, useEffect } from 'react';

// Singleton shared ticker that only runs when at least one subscriber is active
let sharedInterval: NodeJS.Timeout | null = null;
const listeners = new Set<() => void>();

function startTickerIfNeeded() {
  if (!sharedInterval && listeners.size > 0) {
    sharedInterval = setInterval(() => {
      listeners.forEach((listener) => {
        try {
          listener();
        } catch {
          // Prevent individual listener failures from breaking the loop
        }
      });
    }, 1000);
    if (typeof sharedInterval === 'object' && sharedInterval !== null && 'unref' in sharedInterval) {
      (sharedInterval as any).unref?.();
    }
  }
}

function stopTickerIfIdle() {
  if (listeners.size === 0 && sharedInterval) {
    clearInterval(sharedInterval);
    sharedInterval = null;
  }
}

/**
 * Returns a timestamp (epoch ms) that ticks every 1000ms via a single centralized timer.
 * Any number of mounted components calling this hook share the exact same timer instance,
 * eliminating multi-timer proliferation and synchronizing re-renders into a single batch.
 */
export function useSharedTicker(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const handleTick = () => setNow(Date.now());
    listeners.add(handleTick);
    startTickerIfNeeded();

    return () => {
      listeners.delete(handleTick);
      stopTickerIfIdle();
    };
  }, []);

  return now;
}
