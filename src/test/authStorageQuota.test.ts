import { afterEach, describe, expect, it, vi } from 'vitest';
import { installAuthStorageQuotaRecovery } from '@/integrations/supabase/authStorageQuota';
const key = 'sb-nfrdomdvyrbwuokathtw-auth-token';
let restore: (() => void) | undefined;
afterEach(() => { restore?.(); restore = undefined; vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); });
function simulateFullStorage() {
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k, v) {
    if (this === localStorage && k === key) throw new DOMException('Full', 'QuotaExceededError');
    original.call(this, k, v);
  });
  restore = installAuthStorageQuotaRecovery(key, localStorage, sessionStorage);
}
describe('auth storage quota recovery', () => {
  it('preserves drafts and reload-persistent fallback credentials', () => {
    localStorage.setItem('unsaved-project', 'keep-source');
    localStorage.setItem('chat-history', 'keep-messages');
    simulateFullStorage();
    localStorage.setItem(key, 'test-session');
    expect(sessionStorage.getItem(key)).toBe('test-session');
    restore?.();
    restore = installAuthStorageQuotaRecovery(key, localStorage, sessionStorage);
    expect(localStorage.getItem(key)).toBe('test-session');
    expect(localStorage.getItem('unsaved-project')).toBe('keep-source');
    expect(localStorage.getItem('chat-history')).toBe('keep-messages');
  });
  it('removes fallback credentials on sign-out', () => {
    simulateFullStorage();
    localStorage.setItem(key, 'test-session');
    localStorage.removeItem(key);
    expect(localStorage.getItem(key)).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();
  });
  it('returns to normal persistence when space is available', () => {
    sessionStorage.setItem(key, 'old-session');
    restore = installAuthStorageQuotaRecovery(key, localStorage, sessionStorage);
    localStorage.setItem(key, 'new-session');
    expect(localStorage.getItem(key)).toBe('new-session');
    expect(sessionStorage.getItem(key)).toBeNull();
  });
  it('does not suppress unrelated storage errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError'); });
    restore = installAuthStorageQuotaRecovery(key, localStorage, sessionStorage);
    expect(() => localStorage.setItem('project', 'source')).toThrow('Full');
  });
});