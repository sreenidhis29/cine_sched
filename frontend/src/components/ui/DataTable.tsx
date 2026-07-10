import React from 'react';

interface Column<T> {
  header: string;
  accessorKey: keyof T | string;
  cell?: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  isNumeric?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  className?: string;
}

export function DataTable<T>({ data, columns, className = '' }: DataTableProps<T>) {
  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-outline-variant/50">
            {columns.map((col, i) => (
              <th
                key={i}
                className={`py-3 px-4 font-label-md text-on-surface-variant uppercase tracking-wider ${
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className="border-b border-outline-variant/30 hover:bg-surface-variant/30 transition-colors group"
            >
              {columns.map((col, j) => (
                <td
                  key={j}
                  className={`py-3 px-4 text-on-surface ${
                    col.isNumeric ? 'font-mono-data text-mono-data' : 'font-body-md text-body-md'
                  } ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {col.cell ? col.cell(row) : (row as any)[col.accessorKey]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
