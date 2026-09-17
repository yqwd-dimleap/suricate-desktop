import { useEffect, useRef, useState } from "react";

/**
 * Milliseconds of no new tokens before a reasoning stream counts as settled.
 * Live token streaming arrives far faster than this (tens of ms apart), so a
 * quiet period this long means the model has stopped emitting — either it's
 * about to issue a tool call or the turn is done. This is what lets the
 * "Thinking" shimmer settle promptly instead of waiting for the finalizing
 * event to supersede the streaming delta.
 */
const REASONING_STREAM_QUIET_MS = 800;

/**
 * Whether a streaming reasoning block is still receiving tokens.
 *
 * True while `enabled` and `fingerprint` (a signature of the streamed content)
 * has changed within the last `REASONING_STREAM_QUIET_MS`. A live
 * `StreamingDeltaEvent` grows on every token, so the fingerprint changes
 * continuously while the model emits and goes quiet the moment it pauses or
 * stops. Pass a stable/empty fingerprint (and `enabled=false`) for
 * non-streaming events so the hook is a no-op there.
 */
export function useReasoningStreamActive(
  fingerprint: string,
  enabled: boolean,
): boolean {
  const lastTokenAtRef = useRef(0);
  const [active, setActive] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    // A new fingerprint means new tokens arrived: mark active and reset the
    // quiet window. (On the first sight of an enabled stream this also serves
    // as the baseline so it isn't treated as already-settled.)
    lastTokenAtRef.current = Date.now();
    setActive(true);

    const settleTimer = setTimeout(() => {
      if (Date.now() - lastTokenAtRef.current >= REASONING_STREAM_QUIET_MS) {
        setActive(false);
      }
    }, REASONING_STREAM_QUIET_MS);

    return () => clearTimeout(settleTimer);
  }, [fingerprint, enabled]);

  return enabled && active;
}
