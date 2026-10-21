import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';

afterEach(cleanup);

describe('DialogTrigger', () => {
  it('uses its child button for asChild without nesting another button', () => {
    const onClick = vi.fn();
    const { container } = render(
      <Dialog>
        <DialogTrigger asChild>
          <Button onClick={onClick}>Add Contact</Button>
        </DialogTrigger>
      </Dialog>,
    );

    expect(container.querySelectorAll('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add Contact' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});