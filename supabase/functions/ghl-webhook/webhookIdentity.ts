export function isUnresolvedGhlIdentifier(value: string | null): boolean {
  if (!value) return false;
  const candidate = value.trim();
  return (
    /^\{\{?.+\}\}?$/.test(candidate) ||
    /^REPLACE_WITH_/i.test(candidate) ||
    /^(contact|business|location)\.[\w.]+$/i.test(candidate)
  );
}