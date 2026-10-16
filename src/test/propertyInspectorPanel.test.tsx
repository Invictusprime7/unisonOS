import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PropertyInspectorPanel } from '@/components/creatives/web-builder/PropertyInspectorPanel';
import { getVariantById } from '@/sections/variants/registry';
import type { InspectorSelection } from '@/services/builder/propertyInspectorModel';

afterEach(cleanup);

const selection: InspectorSelection = {
  attributes: { 'data-ut-variant': 'hero:full-bleed' },
  scopeAncestors: { sectionId: 'hero-1', sectionType: 'hero' },
};

describe('property inspector mutation lifecycle', () => {
  it('keeps layout choices usable and explains why confirmation cannot commit without identity', () => {
    const onApplyPatchPlan = vi.fn();
    render(
      <PropertyInspectorPanel
        selection={{
          attributes: { 'data-ut-variant': 'hero:launch-showcase' },
          scopeAncestors: { sectionType: 'hero' },
        }}
        onApplyPatchPlan={onApplyPatchPlan}
      />,
    );

    const imageFan = getVariantById('hero:image-fan')!;
    expect(screen.getByText(/no canonical section identity/i)).toBeInTheDocument();
    fireEvent.click(screen.getByText(imageFan.name, { exact: true }).closest('button')!);
    const confirm = screen.getByRole('button', { name: `Confirm ${imageFan.name}` });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    expect(screen.getByText('No canonical section identity for this selection.')).toBeInTheDocument();
    expect(onApplyPatchPlan).not.toHaveBeenCalled();
  });

  it('waits for preview adoption and retains the panel when the mutation fails', async () => {
    let finishApply!: (applied: boolean) => void;
    const onApplyPatchPlan = vi.fn(() => new Promise<boolean>((resolve) => {
      finishApply = resolve;
    }));
    const centered = getVariantById('hero:centered')!;
    render(<PropertyInspectorPanel selection={selection} onApplyPatchPlan={onApplyPatchPlan} />);

    const centeredButton = screen.getByText(centered.name, { exact: true }).closest('button')!;
    fireEvent.click(centeredButton);
    expect(onApplyPatchPlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: `Confirm ${centered.name}` }));
    expect(onApplyPatchPlan).toHaveBeenCalledOnce();
    expect(screen.getByText('Applying...')).toBeInTheDocument();

    await act(async () => finishApply(false));

    expect(screen.getByText('Preview did not confirm this change; see the status message for details.')).toBeInTheDocument();
    expect(centeredButton).toBeInTheDocument();
  });
});