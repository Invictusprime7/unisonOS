/** Conditional filters are part of the UPDATE itself, closing the read/write race. */
export function applyExpectedFilters<T extends { eq(column: string, value: unknown): T; is(column: string, value: null): T }>(
  query: T, expected: Record<string, unknown>, writable: Record<string, unknown>,
): T {
  for (const [key, value] of Object.entries(expected)) {
    if (!(key in writable) || !/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) throw new Error(`Invalid expected field: ${key}`);
    query = value == null ? query.is(key, null) : query.eq(key, value);
  }
  return query;
}