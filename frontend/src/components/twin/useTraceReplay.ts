/**
 * Steps through a trace at the pace it actually ran.
 *
 * The stages are replayed rather than streamed, because the server returns the
 * whole trace at once. What makes the replay honest is that the gaps between
 * stages are the measured durations -- the model call really does take three
 * seconds while the local steps take single-digit milliseconds, and the
 * animation shows that shape instead of an even sequence.
 *
 * Very short stages are given a floor so they are perceptible, and the whole
 * replay is capped so a slow response does not leave someone watching a
 * diagram for eight seconds. Both are stated on screen rather than hidden.
 */

import { useEffect, useRef, useState } from 'react';
import type { Trace } from '../../lib/types';

/** Below this, a stage would flash by unseen. */
const MIN_STAGE_MS = 260;
/** Longest the whole replay may take. */
const MAX_TOTAL_MS = 4200;

export interface Replay {
  /** Index of the last stage revealed; -1 before it starts. */
  upto: number;
  running: boolean;
  /** True when the replay has been compressed to fit MAX_TOTAL_MS. */
  compressed: boolean;
  restart: () => void;
}

export function useTraceReplay(trace: Trace | null, enabled = true): Replay {
  const [upto, setUpto] = useState(-1);
  const [running, setRunning] = useState(false);
  const [nonce, setNonce] = useState(0);
  const timers = useRef<number[]>([]);

  const stages = trace?.stages ?? [];
  const rawTotal = stages.reduce((sum, s) => sum + Math.max(s.ms, MIN_STAGE_MS), 0);
  const scale = rawTotal > MAX_TOTAL_MS ? MAX_TOTAL_MS / rawTotal : 1;
  const compressed = scale < 1;

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (!trace || stages.length === 0) {
      setUpto(-1);
      setRunning(false);
      return;
    }

    // Someone who has asked for reduced motion gets the finished state
    // immediately. The information is identical; only the reveal is skipped.
    if (!enabled) {
      setUpto(stages.length - 1);
      setRunning(false);
      return;
    }

    setUpto(-1);
    setRunning(true);

    let elapsed = 0;
    stages.forEach((stage, i) => {
      elapsed += Math.max(stage.ms, MIN_STAGE_MS) * scale;
      const id = window.setTimeout(() => {
        setUpto(i);
        if (i === stages.length - 1) setRunning(false);
      }, elapsed);
      timers.current.push(id);
    });

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // `nonce` lets the caller replay the same trace again.
  }, [trace, enabled, nonce]);

  return {
    upto,
    running,
    compressed,
    restart: () => setNonce((n) => n + 1),
  };
}

/** Whether the visitor has asked the system to reduce motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
