import type { ReactNode } from "react";

export function FinancePageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="finance-page-header">
      <div>
        <h1 className="finance-page-header__title">{title}</h1>
        {description && (
          <p className="finance-page-header__desc">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}
