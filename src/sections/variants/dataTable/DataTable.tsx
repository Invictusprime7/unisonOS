import React from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl } from '../../themeUtils';
import { tableCellBinding, tableCellValue } from './tableData';

const DEFAULT_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'updated', label: 'Last updated' },
];

const DEFAULT_ROWS: Array<Record<string, string>> = [
  { name: 'Spring campaign', status: 'Active', updated: '2 days ago' },
  { name: 'Onboarding flow', status: 'Draft', updated: '5 days ago' },
  { name: 'Annual report', status: 'Archived', updated: '3 weeks ago' },
];

/**
 * data-table:striped-rows — a readable striped data table for app
 * dashboard pages. Rows scroll horizontally on narrow screens.
 */
export const DataTable: React.FC<BaseSectionProps<'data-table'>> = ({ section, theme }) => {
  const p = section.props;
  const heading = p.heading ?? 'Recent work';
  const columns = p.columns ?? DEFAULT_COLUMNS;
  const rows = p.rows ?? DEFAULT_ROWS;
  const emptyMessage = p.emptyMessage ?? 'Nothing here yet.';

  return (
    <section
      data-ut-variant="data-table:striped-rows"
      className="px-6 py-12 sm:px-10 sm:py-16"
      style={{ background: hsl(theme.colors.background) }}
    >
      <div className="mx-auto space-y-6" style={{ maxWidth: theme.containerWidth }}>
        <h2
          data-ut-slot="table.heading"
          className="text-xl font-semibold tracking-tight sm:text-2xl"
          style={{
            fontFamily: theme.typography.headingFont,
            fontWeight: theme.typography.headingWeight,
            color: hsl(theme.colors.foreground),
          }}
        >
          {heading}
        </h2>
        <div className="overflow-x-auto" style={{ borderRadius: theme.radius, border: `1px solid ${hsl(theme.colors.border)}` }}>
          <table className="w-full border-collapse text-left text-sm" style={{ color: hsl(theme.colors.foreground) }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${hsl(theme.colors.border)}`, background: hsl(theme.colors.muted) }}>
                {columns.map((column) => (
                  <th key={column.key} scope="col" className="px-4 py-3 font-medium" style={{ color: hsl(theme.colors.mutedForeground) }}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody data-ut-slot="table.rows">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center" style={{ color: hsl(theme.colors.mutedForeground) }}>
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr
                    key={typeof row.id === 'string' || typeof row.id === 'number' ? row.id : index}
                    className="last:border-0 motion-reduce:transition-none transition-colors"
                    style={{
                      borderBottom: `1px solid ${hsl(theme.colors.border)}`,
                      background: index % 2 === 0 ? hsl(theme.colors.muted) : 'transparent',
                    }}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className="px-4 py-3" {...tableCellBinding(p.sourceTable, row, column.key)}>
                        {tableCellValue(row[column.key])}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
