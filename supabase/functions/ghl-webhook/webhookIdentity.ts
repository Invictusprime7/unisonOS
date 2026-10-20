export function isUnresolvedGhlIdentifier(value: string | null): boolean {
  if (!value) return false;
  const candidate = value.trim();
  return (
    /^\{\{?.+\}\}?$/.test(candidate) ||
    /^REPLACE_WITH_/i.test(candidate) ||
    /^(contact|business|location)\.[\w.]+$/i.test(candidate)
  );
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}