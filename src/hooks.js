import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

export function useResource(path, interval = 0) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  const latestPath = useRef(path);
  latestPath.current = path;

  useEffect(() => {
    const controller = new AbortController();
    let timer;
    setState({ data: null, loading: true, error: '' });
    const load = async () => {
      try {
        const data = await api(path, { signal: controller.signal });
        if (!controller.signal.aborted && latestPath.current === path) setState({ data, loading: false, error: '' });
      } catch (error) {
        if (!controller.signal.aborted) setState((prev) => ({ ...prev, loading: false, error: error.message }));
      } finally {
        if (interval && !controller.signal.aborted) timer = setTimeout(load, interval);
      }
    };
    load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [path, version, interval]);
  return { ...state, refresh };
}

export function useDebounce(value, delay = 300) {
  const [result, setResult] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setResult(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return result;
}
