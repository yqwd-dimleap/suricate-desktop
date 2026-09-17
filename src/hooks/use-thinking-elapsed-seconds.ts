import { useEffect, useRef, useState } from "react";

/**
 * Bounded cache so a live thinking block that remounts as a settled "Thought"
 * (streaming delta → final action) can still show the frozen duration.
 *
 * Entries are keyed by trimmed content, and lookup also accepts a prefix /
 * extension match so the final action's slightly different fingerprint still
 * finds the duration recorded while the delta was streaming. Historical
 * thoughts that never went live miss the cache and render without a duration.
 *
 * Live clock continuation (remount while still thinking) only uses entries
 * marked `liveHandoff`. Settled thoughts clear that flag so a later turn that
 * happens to share a content prefix cannot jump-start at 28s.
 */
const MAX_SETTLED_CACHE = 32;
/** Ignore short fingerprints for prefix matching — they collide across turns. */
const MIN_PREFIX_MATCH_LENGTH = 24;

type CacheEntry = {
  seconds: number;
  /** True only while a stream was interrupted mid-flight (unmount handoff). */
  liveHandoff: boolean;
};

const settledElapsedByContent = new Map<string, CacheEntry>();

function cacheKey(content: string): string {
  return content.trim();
}

function rememberElapsed(
  content: string,
  seconds: number,
  liveHandoff: boolean,
): void {
  const key = cacheKey(content);
  if (!key) {
    return;
  }
  if (settledElapsedByContent.has(key)) {
    settledElapsedByContent.delete(key);
  }
  settledElapsedByContent.set(key, { seconds, liveHandoff });
  while (settledElapsedByContent.size > MAX_SETTLED_CACHE) {
    const oldest = settledElapsedByContent.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    settledElapsedByContent.delete(oldest);
  }
}

/**
 * Exact match first; otherwise the longest cached key that is a prefix of
 * `content` or that `content` is a prefix of (streaming text vs finalized).
 * When `liveHandoffOnly` is set, skip settled-only entries so a new Thinking
 * turn cannot inherit a previous Thought's duration.
 */
function lookupElapsed(
  content: string,
  liveHandoffOnly: boolean,
): number | null {
  const key = cacheKey(content);
  if (!key) {
    return null;
  }
  const exact = settledElapsedByContent.get(key);
  if (exact != null && (!liveHandoffOnly || exact.liveHandoff)) {
    return exact.seconds;
  }

  if (key.length < MIN_PREFIX_MATCH_LENGTH) {
    return null;
  }

  let bestSeconds: number | null = null;
  let bestKeyLength = -1;
  for (const [cachedKey, entry] of settledElapsedByContent) {
    if (liveHandoffOnly && !entry.liveHandoff) {
      continue;
    }
    if (cachedKey.length < MIN_PREFIX_MATCH_LENGTH) {
      continue;
    }
    if (key.startsWith(cachedKey) || cachedKey.startsWith(key)) {
      if (cachedKey.length > bestKeyLength) {
        bestKeyLength = cachedKey.length;
        bestSeconds = entry.seconds;
      }
    }
  }
  return bestSeconds;
}

/** Test-only: clear the remount cache between cases. */
export function clearThinkingElapsedCacheForTests(): void {
  settledElapsedByContent.clear();
}

/**
 * Whole-second wall-clock duration for a thinking block.
 *
 * - Starts when `isThinking` first becomes true on this mount.
 * - Ticks while thinking; freezes when thinking settles.
 * - Quiet-window flicker (settle → resume on the same mount) keeps the
 *   original start clock — it does not reset to 0s.
 * - Returns `null` for historical thoughts that never went live.
 * - Survives remounts via a short settled-content cache (prefix-tolerant).
 * - A brand-new Thinking turn always starts at 0s; only an in-flight remount
 *   handoff may continue a prior clock.
 */
export function useThinkingElapsedSeconds(
  isThinking: boolean,
  content: string,
): number | null {
  const startAtRef = useRef<number | null>(null);
  const frozenRef = useRef<number | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  const [elapsed, setElapsed] = useState<number | null>(() => {
    if (isThinking) {
      return 0;
    }
    return lookupElapsed(content, false);
  });

  useEffect(() => {
    if (isThinking) {
      if (startAtRef.current == null) {
        // Only continue a clock when an in-flight remount handed off; never
        // inherit a settled Thought's duration for a new turn.
        const handoff = lookupElapsed(content, true);
        if (handoff != null) {
          startAtRef.current = Date.now() - handoff * 1000;
        } else {
          startAtRef.current = Date.now();
        }
        frozenRef.current = null;
      }
      const tick = () => {
        if (startAtRef.current == null) {
          return;
        }
        setElapsed(Math.floor((Date.now() - startAtRef.current) / 1000));
      };
      tick();
      const id = window.setInterval(tick, 1000);
      return () => window.clearInterval(id);
    }

    if (startAtRef.current != null) {
      // Freeze the displayed value but keep startAtRef so a quiet-window
      // resume on this same mount continues the original clock.
      const seconds = Math.floor((Date.now() - startAtRef.current) / 1000);
      frozenRef.current = seconds;
      rememberElapsed(content, seconds, false);
      setElapsed(seconds);
      return undefined;
    }

    if (frozenRef.current != null) {
      rememberElapsed(content, frozenRef.current, false);
      setElapsed(frozenRef.current);
      return undefined;
    }

    setElapsed(lookupElapsed(content, false));
    return undefined;
  }, [isThinking, content]);

  // Persist the latest content fingerprint on unmount so a delta → action
  // remount can still find the frozen duration. Mid-flight unmounts mark
  // liveHandoff so a remount that is still thinking can continue the clock.
  useEffect(
    () => () => {
      if (frozenRef.current != null) {
        rememberElapsed(contentRef.current, frozenRef.current, false);
      } else if (startAtRef.current != null) {
        rememberElapsed(
          contentRef.current,
          Math.floor((Date.now() - startAtRef.current) / 1000),
          true,
        );
      }
    },
    [],
  );

  return elapsed;
}
