import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * One folding part of the debug panel.
 *
 * Every feature in the panel is a section, and each folds on its own so that the ones being watched can
 * be open while the rest are a row of titles. That is what keeps the panel usable as it fills: it is
 * expected to gain sections, not to stay the size it is.
 *
 * A section is told where a thing belongs. When a step wants to put a button, a reading or a log in the
 * panel it says which section it goes in, and asks if that is not obvious. See decision record 0039.
 */

interface SectionProps {
  /** Shown in the bar, and the key the folded state is remembered under. */
  name: string;
  /** Buttons that belong to this section, sitting in its bar to the right of the title. */
  tools?: ReactNode;
  /**
   * A reading in the header that is there whether the section is open or folded, for the one number worth
   * glancing at without opening it. The tools are only there open, because a folded section's buttons are
   * targets for a hand that meant to unfold it.
   */
  reading?: ReactNode;
  /**
   * The one control that is the section's own on and off, in the bar whether it is open or folded, so a shader
   * can be turned off without opening its part. Unlike the tools, it is the thing a hand reaching for the bar is
   * after.
   */
  control?: ReactNode;
  children: ReactNode;
}

function rememberedAs(name: string): string {
  return `villages.debug.fold.${name.toLowerCase().replace(/\s+/g, '-')}`;
}

export function Section({ name, tools, reading, control, children }: SectionProps) {
  // Every section starts folded, so the panel opens as a row of titles with their switches, and what is
  // opened is what is being watched. Adam's word of 2026-10-11.
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(rememberedAs(name)) === 'yes';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(rememberedAs(name), open ? 'yes' : 'no');
    } catch {
      // As everywhere else here: the choice not surviving a reload is not worth failing over.
    }
  }, [name, open]);

  return (
    <section className={`debug__section${open ? '' : ' debug__section--shut'}`}>
      <header className="debug__sectionbar">
        {/*
          The whole of the empty bar folds, not just the chevron: a two-millimetre target for something
          done this often is a target missed. The tools sit outside it so they are still their own.
        */}
        <button
          type="button"
          className="debug__fold"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          title={open ? `fold ${name}` : `unfold ${name}`}
        >
          <span className="debug__chevron" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          <span className="debug__title">{name}</span>
        </button>
        {reading}
        {control}
        {open && tools}
      </header>

      {open && <div className="debug__sectionbody">{children}</div>}
    </section>
  );
}
