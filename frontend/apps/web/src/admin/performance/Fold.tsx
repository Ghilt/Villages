import type { ReactNode } from 'react';

/** A chapter of the performance page, folded under its title, with a word beside it on what it was read from. */
export function Fold({
  title,
  aside,
  open = true,
  children,
}: {
  title: string;
  aside?: ReactNode;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="perf-fold" open={open}>
      <summary>
        <h2 className="inspect-group__title">{title}</h2>
        {aside !== undefined && <span className="perf-fold__aside">{aside}</span>}
      </summary>
      {children}
    </details>
  );
}
