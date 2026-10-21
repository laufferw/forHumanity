import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs `load` on mount (and whenever `deps` change) and exposes its result
 * plus a `reload` function. Results arriving after unmount, or after a newer
 * call has started, are ignored.
 */
export default function useLoader(load, initialData, deps = []) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const loadRef = useRef(load);
  loadRef.current = load;

  const latestCall = useRef(0);

  const reload = useCallback(async () => {
    // Only the most recent call may update state, so a slow earlier response
    // (e.g. before a filter change) can't overwrite a newer one.
    const callId = ++latestCall.current;
    const isCurrent = () => mounted.current && callId === latestCall.current;

    setLoading(true);
    setError('');
    try {
      const result = await loadRef.current();
      if (isCurrent()) setData(result);
    } catch (err) {
      if (isCurrent()) setError(err?.message || 'Could not load data.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, ...deps]);

  return { data, setData, loading, error, setError, reload };
}
