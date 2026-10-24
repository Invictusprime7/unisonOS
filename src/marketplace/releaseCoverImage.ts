/** Read image references only; never compile or execute published source for a card. */
export function resolveReleaseCoverImage(files: Record<string, string>): string | undefined {
  const source = Object.entries(files)
    .filter(([path]) => /\.(tsx?|jsx?|html|css)$/.test(path))
    .map(([, text]) => text).join('\n');
  const refs = source.match(/https:\/\/images\.unsplash\.com\/photo-[^\s"'`<>\\)]+|https:\/\/[^\s"'`<>\\)]+\.(?:png|jpe?g|webp|avif)(?:\?[^\s"'`<>\\)]*)?|\/(?:assets\/)[^\s"'`<>\\)]+\.(?:png|jpe?g|webp|avif|svg)/gi) ?? [];
  for (const ref of refs) {
    if (ref.startsWith('https://')) return ref;
    // Local package assets must be self-contained, never requested from the host app.
    const contents = files[ref] ?? files[`/public${ref}`];
    if (contents?.startsWith('data:image/')) return contents;
    if (ref.endsWith('.svg') && contents?.trimStart().startsWith('<svg')) {
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(contents)}`;
    }
  }
  return undefined;
}