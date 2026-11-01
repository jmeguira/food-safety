import { useEffect, useState } from "react";

export type Loaded<T> = { data: T } | { error: string } | null;

/** Fetches `url` from the API; null while loading or when `url` is null. A newer url supersedes an older response. */
export function useApi<T>(url: string | null): Loaded<T> {
  const [state, setState] = useState<{ url: string | null; result: Loaded<T> }>({ url, result: null });
  useEffect(() => {
    if (url === null) return;
    let current = true;
    fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(`${r.status}`))))
      .then((data) => current && setState({ url, result: { data } }))
      .catch((e: Error) => current && setState({ url, result: { error: e.message } }));
    return () => {
      current = false;
    };
  }, [url]);
  return state.url === url ? state.result : null;
}
