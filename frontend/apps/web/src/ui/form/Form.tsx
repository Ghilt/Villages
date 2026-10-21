import './form.css';

import type { ReactNode } from 'react';

/**
 * A form: fields one under another and the buttons that answer them under those, sent by its `TextButton sends` or by
 * Enter in any field, which is `onSend`. A real `<form>`, so a browser's password manager finds the email and the
 * password in it, fills them, and offers to save them once it is sent. What it says while it is being sent, or what
 * was wrong when it was, is its holder's to put among its fields. See docs/UI-COMPONENTS.md.
 */
export function Form({
  onSend,
  label,
  children,
  actions,
}: {
  onSend: () => void;
  /** What the form is for, for a screen reader: Sign in. */
  label: string;
  children: ReactNode;
  /** Its buttons, last the one that sends it. */
  actions?: ReactNode;
}) {
  return (
    <form
      className="ui-form"
      aria-label={label}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      {children}
      {actions !== undefined && <div className="ui-form__actions">{actions}</div>}
    </form>
  );
}
