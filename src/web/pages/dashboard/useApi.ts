import { useEffect, useState } from "react";

export type Loaded<T> = { data: T } | { error: string } | null;

const TIMEOUT_MS = 15_000;

/** Fetches `url` from the API; null while loading or when `url` is null. A newer url supersedes an older response, and a request that outlasts the timeout is an error. */
export function useApi<T>(url: string | null): Loaded<T> {
  const [state, setState] = useState<{ url: string | null; result: Loaded<T> }>({ url, result: null });
  useEffect(() => {
    if (url === null) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(TIMEOUT_MS)]);
    fetch(url, { signal })
      .then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(`${r.status}`))))
      .then((data) => !controller.signal.aborted && setState({ url, result: { data } }))
      .catch((e: Error) => {
        if (controller.signal.aborted) return;
        const timedOut = e.name === "TimeoutError" || e.name === "AbortError";
        setState({ url, result: { error: timedOut ? "timed out" : e.message } });
      });
    return () => controller.abort();
  }, [url]);
  return state.url === url ? state.result : null;
}
