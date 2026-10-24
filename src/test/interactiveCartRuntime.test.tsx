import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/runtime/TemplateRuntimeProvider', () => ({
  TemplateRuntimeContext: React.createContext(null),
}));
import { TemplateRuntimeContext } from '@/runtime/TemplateRuntimeProvider';
import { InteractiveIcon } from '@/components/ui/InteractiveIcon';

afterEach(cleanup);
describe('interactive bag runtime connection', () => {
  it('uses the cart count without requiring generated pages to pass a manual badge prop', () => {
    const executeIntent = vi.fn().mockResolvedValue({ ok: true });
    const runtime = { cartItemCount: 3, executeIntent } as unknown as React.ContextType<typeof TemplateRuntimeContext>;
    render(<TemplateRuntimeContext.Provider value={runtime}><InteractiveIcon iconKey="cart" /></TemplateRuntimeContext.Provider>);
    const bag = screen.getByRole('button');
    expect(bag.textContent).toBe('3');
    fireEvent.click(bag);
    expect(executeIntent).toHaveBeenCalledWith('cart.view');
  });
});