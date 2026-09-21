import type { ReactNode } from "react";

type PageHeaderProps = {
  /** Optional small caps line above the title (e.g. "People operations") */
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Shared page title block — keeps every tenant screen on the same rhythm.
 */
export function PageHeader({ eyebrow, title, description, actions, className = "" }: PageHeaderProps) {
  return (
    <header className={["rc-page-header", className].filter(Boolean).join(" ")}>
      <div className="min-w-0">
        {eyebrow ? <p className="rc-page-eyebrow">{eyebrow}</p> : null}
        <h1 className={eyebrow ? "rc-page-title" : "rc-page-title !mt-0"}>{title}</h1>
        {description ? <div className="rc-page-desc">{description}</div> : null}
      </div>
      {actions ? <div className="rc-page-actions">{actions}</div> : null}
    </header>
  );
}
