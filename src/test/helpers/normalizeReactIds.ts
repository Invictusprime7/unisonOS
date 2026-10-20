/** Compare separate React roots without discarding label/control relationships. */
export function normalizeReactIds(markup: string): string {
  const ids = new Map<string, string>();
  return markup.replace(/_[rR]_[a-z0-9]+_/g, id => {
    if (!ids.has(id)) ids.set(id, 'react-id-' + ids.size);
    return ids.get(id)!;
  });
}
