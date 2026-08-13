import type { ReactNode } from "react";

export function FinanceDataTable({
  columns,
  rows,
  emptyMessage = "Nenhum registro encontrado.",
}: {
  columns: string[];
  rows: ReactNode[][];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="finance-form-card p-8 text-center text-sm text-[#6b7280] dark:text-zinc-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="finance-table-wrap">
      <table className="finance-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
