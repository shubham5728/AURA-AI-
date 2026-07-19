/**
 * Loads everything the overview needs.
 *
 * One request. The previous dashboard made five, assembled the results in the
 * browser, and one of them asked for a resource the backend does not model --
 * so a fifth of the screen was permanently empty and the rest arrived in
 * pieces.
 */

import { useCallback, useEffect, useState } from 'react';
import { get } from '../../lib/api';
import type { Overview } from './types';

interface State {
  data: Overview | null;
  loading: boolean;
  error: string;
  reload: () => void;
}

export function useOverview(): State {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await get<Overview>('/api/overview'));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

/** Areas the score could not assess, in words a person recognises. */
const COVERAGE_LABELS: Record<string, string> = {
  labs: 'lab results',
  sleep: 'sleep',
  activity: 'daily activity',
  body: 'height and weight',
  hydration: 'hydration',
  medication: 'medications',
};

export function unassessed(coverage: Record<string, boolean>): string[] {
  return Object.entries(coverage)
    .filter(([, covered]) => !covered)
    .map(([key]) => COVERAGE_LABELS[key] ?? key);
}
