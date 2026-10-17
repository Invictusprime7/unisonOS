import React from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl } from '../../themeUtils';
import { tableCellBinding, tableCellValue } from './tableData';

const DEFAULT_STATS = [
  { label: 'Active projects', value: '12', change: '+2 this week' },
  { label: 'Open enquiries', value: '38', change: '+9 this week' },
  { label: 'Invoices due', value: '4', change: '2 overdue' },
];
const DEFAULT_COLUMNS = [
  { key: 'name', label: 'Project' },
  { key: 'client', label: 'Client' },
  { key: 'status', label: 'Status' },
];
const DEFAULT_ROWS: Array<Record<string, string>> = [
  { name: 'Brand refresh', client: 'Northline Studio', status: 'In review' },
  { name: 'Spring campaign', client: 'Harbor & Co', status: 'Active' },
  { name: 'Website rebuild', client: 'Fielder Dental', status: 'Draft' },
];

/**
 * data-table:dashboard-overview — KPI tiles above a work table for app
 * dashboard pages. Motion: tiles lift on hover only when motion is allowed;
 * the reduced-motion fallback keeps tiles static with a border-color cue.
 */
export const DashboardOverview: React.FC<BaseSectionProps<'data-table'>> = ({ section, theme }) => {
  const p = section.props;
  const heading = p.heading ?? 'Overview';
  const stats = p.stats ?? DEFAULT_STATS;
  const columns = p.columns ?? DEFAULT_COLUMNS;
  const rows = p.rows ?? DEFAULT_ROWS;
  const emptyMessage = p.emptyMessage ?? 'Nothing here yet.';

  return (
    <section
      data-ut-variant="data-table:dashboard-overview"
      className="px-4 py-10 sm:px-10 sm:py-14"
      style={{ background: hsl(theme.colors.background) }}
    >
      <div className="mx-auto space-y-8" style={{ maxWidth: theme.containerWidth }}>
        <h1
          data-ut-slot="dashboard.heading"
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
          style={{ fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight, color: hsl(theme.colors.foreground) }}
        >
          {heading}
        </h1>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-ut-slot="dashboard.stats">
          {stats.map((s) => (
            <li
              key={s.label}
              className="p-5 motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-reduce:transform-none"
              style={{ borderRadius: theme.radius, border: `1px solid ${hsl(theme.colors.border)}`, background: hsl(theme.colors.muted) }}
            >
              <p className="text-sm" style={{ color: hsl(theme.colors.mutedForeground) }}>{s.label}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums" style={{ color: hsl(theme.colors.foreground) }}>{s.value}</p>
              {s.change && <p className="mt-1 text-xs" style={{ color: hsl(theme.colors.mutedForeground) }}>{s.change}</p>}
            </li>
          ))}
        </ul>
        <div className="overflow-x-auto" style={{ borderRadius: theme.radius, border: `1px solid ${hsl(theme.colors.border)}` }}>
          <table className="w-full text-left text-sm" data-ut-slot="dashboard.table">
            <thead style={{ background: hsl(theme.colors.muted) }}>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} scope="col" className="px-4 py-3 font-medium" style={{ color: hsl(theme.colors.mutedForeground) }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={columns.length} className="px-4 py-8 text-center" style={{ color: hsl(theme.colors.mutedForeground) }}>{emptyMessage}</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={typeof r.id === 'string' || typeof r.id === 'number' ? r.id : i} style={{ borderTop: `1px solid ${hsl(theme.colors.border)}` }}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3" style={{ color: hsl(theme.colors.foreground) }} {...tableCellBinding(p.sourceTable, r, c.key)}>{tableCellValue(r[c.key])}</td>
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
