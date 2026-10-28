import { describe, expect, it, vi } from 'vitest';
import type { EditorCommand } from '@/services/editor/editorCommandTypes';

// Exercise the adapter and real command router without mounting the Builder shell.
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useCallback: (callback: unknown) => callback,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), loading: vi.fn(), dismiss: vi.fn(), success: vi.fn() } }));

import { useToolbarCommands } from '@/components/creatives/web-builder/toolbarCommandAdapter';

function fixture() {
  const handlers = {
    onUpdateStyles: vi.fn(), onUpdateAttributes: vi.fn(), onReplaceImage: vi.fn(),
    onDelete: vi.fn(), onDuplicate: vi.fn(), onMoveUp: vi.fn(), onMoveDown: vi.fn(),
  };
  return { handlers, run: useToolbarCommands(handlers, { businessId: 'business', projectId: 'site' }) };
}
const target = { selector: '#contact', ownerKind: 'source' as const, sourceLocator: '/src/pages/contact.tsx:2:1' };

describe('floating toolbar action routing', () => {
  it.each(['up', 'down'] as const)('hands move %s to the source order handler', async (direction) => {
    const { handlers, run } = fixture();
    const result = await run({ type: 'move', target, direction });
    expect(result).toMatchObject({ ok: true, lane: 'source' });
    expect(direction === 'up' ? handlers.onMoveUp : handlers.onMoveDown).toHaveBeenCalledExactlyOnceWith('#contact');
    expect(direction === 'up' ? handlers.onMoveDown : handlers.onMoveUp).not.toHaveBeenCalled();
  });
  it('hands hide to the style handler', async () => {
    const { handlers, run } = fixture();
    expect(await run({ type: 'set-style', target, styles: { display: 'none' } })).toMatchObject({ ok: true, lane: 'presentation' });
    expect(handlers.onUpdateStyles).toHaveBeenCalledExactlyOnceWith('#contact', { display: 'none' });
  });
  it.each(['duplicate', 'delete'] as const)('hands %s to its source handler', async (type) => {
    const { handlers, run } = fixture();
    expect(await run({ type, target })).toMatchObject({ ok: true, lane: 'source' });
    expect(type === 'duplicate' ? handlers.onDuplicate : handlers.onDelete).toHaveBeenCalledExactlyOnceWith('#contact');
  });
  it('refuses move when the host has no order handler', async () => {
    const { handlers } = fixture();
    const run = useToolbarCommands({ ...handlers, onMoveUp: undefined }, {});
    expect((await run({ type: 'move', target, direction: 'up' })).ok).toBe(false);
  });
  it('keeps unknown selections read-only for every action', async () => {
    const { handlers, run } = fixture();
    const unknown = { ...target, ownerKind: 'unbound' as const };
    const commands: EditorCommand[] = [
      { type: 'move', target: unknown, direction: 'down' }, { type: 'duplicate', target: unknown },
      { type: 'delete', target: unknown }, { type: 'set-style', target: unknown, styles: { display: 'none' } },
    ];
    for (const command of commands) expect((await run(command)).ok).toBe(false);
    for (const handler of Object.values(handlers)) expect(handler).not.toHaveBeenCalled();
  });
});