import { useEffect, useState } from 'react';

/**
 * JSON from the dev server, or null while it is asked for, or 'missing' when it cannot be had: a tree that has cut
 * nothing yet has no atlas, and a built page has no dev server. Read again whenever the dev server sends [again].
 */
export function useJson<T>(url: string, again?: string): T | null | 'missing' {
  const [read, setRead] = useState<T | null | 'missing'>(null);
  useEffect(() => {
    let live = true;
    const ask = () =>
      fetch(url, { cache: 'no-store' })
        .then((response) =>
          response.ok ? (response.json() as Promise<T>) : Promise.reject(new Error(String(response.status))),
        )
        .then((json) => live && setRead(json))
        .catch(() => live && setRead('missing'));
    void ask();
    if (again !== undefined) import.meta.hot?.on(again, ask);
    return () => {
      live = false;
      if (again !== undefined) import.meta.hot?.off(again, ask);
    };
  }, [url, again]);
  return read;
}
