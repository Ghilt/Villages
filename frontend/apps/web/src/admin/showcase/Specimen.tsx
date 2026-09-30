import type { ReactNode } from 'react';

/**
 * One thing on show, with its caption underneath, as the moodboard captions each of its pieces.
 *
 * The caption is the component's name as it is written in code, so that what Adam points at on the page
 * is what a session searches for. `note` is anything worth knowing that the thing cannot say itself.
 */
export function Specimen({
  name,
  note,
  wide = false,
  children,
}: {
  name: string;
  note?: string;
  /** Take the whole row rather than a cell of it. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <figure className={`showcase__specimen${wide ? ' showcase__specimen--wide' : ''}`}>
      <div className="showcase__stage">{children}</div>
      <figcaption className="showcase__caption">
        <span className="showcase__name">{name}</span>
        {note !== undefined && <span className="showcase__note">{note}</span>}
      </figcaption>
    </figure>
  );
}

/** A row of specimens, as many to a line as the sheet has room for. */
export function Specimens({ children }: { children: ReactNode }) {
  return <div className="showcase__specimens">{children}</div>;
}

/** A named part of a section: Colours, Type. */
export function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="showcase__part">
      <h3 className="ui-caps showcase__part-title">{title}</h3>
      {children}
    </div>
  );
}
