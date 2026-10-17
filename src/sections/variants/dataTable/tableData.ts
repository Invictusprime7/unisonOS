/** Only displayable data reaches React children; objects remain data, never JSX. */
export function tableCellValue(value: unknown): string | number {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  if (typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const display = record.label ?? record.value;
    if (typeof display === 'string' || typeof display === 'number' || typeof display === 'boolean') return tableCellValue(display);
  }
  return '';
}

/** A row index must never masquerade as a persisted record identity. */
export function tableCellBinding(sourceTable: string | undefined, row: Record<string, unknown>, field: string) {
  const id = row.id;
  if (!sourceTable || (typeof id !== 'string' && typeof id !== 'number') || String(id).trim() === '') return {};
  return { 'data-ut-source-table': sourceTable, 'data-ut-row-id': String(id), 'data-ut-field': field };
}