import { useCallback, useEffect, useRef, useState } from 'react';
import { errMsg } from '../services/api';

/** Runs an async function on mount / when deps change and exposes {data, loading, error, reload, setData}. */
export default function useAsync(fn, deps = [], { immediate = true } = {}) {
  const [state, setState] = useState({ data: null, loading: immediate, error: null });
  const alive = useRef(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (silent = false) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (alive.current) setState({ data, loading: false, error: null });
      return data;
    } catch (e) {
      if (alive.current) setState((s) => ({ data: silent ? s.data : null, loading: false, error: errMsg(e) }));
      return null;
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    if (immediate) run();
    return () => { alive.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const setData = useCallback((updater) => setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater })), []);
  return { ...state, reload: run, setData };
}
