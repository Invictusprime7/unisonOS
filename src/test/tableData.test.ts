import { describe, expect, it } from 'vitest';
import { tableCellBinding, tableCellValue } from '@/sections/variants/dataTable/tableData';
describe('table record values and ownership', () => {
  it('renders scalar data without losing zero or false', () => {
    expect(tableCellValue(0)).toBe(0);
    expect(tableCellValue(false)).toBe('false');
    expect(tableCellValue({ label: 'Saved name' })).toBe('Saved name');
    expect(tableCellValue({ secret: 'do not render arbitrary records' })).toBe('');
  });
  it('binds only explicitly identified records and fields', () => {
    expect(tableCellBinding('services', { id: 's-8' }, 'price')).toEqual({ 'data-ut-source-table': 'services', 'data-ut-row-id': 's-8', 'data-ut-field': 'price' });
    expect(tableCellBinding('services', { name: 'Unpersisted row' }, 'name')).toEqual({});
    expect(tableCellBinding(undefined, { id: 's-8' }, 'price')).toEqual({});
  });
});