import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWebBuilderState } from '@/hooks/useWebBuilderState';

describe('useWebBuilderState selection sync', () => {
  it('keeps the canvas object and preview element selection in sync instead of clearing one another', () => {
    const { result } = renderHook(() => useWebBuilderState(null));

    const objectSelection = { type: 'textbox', text: 'Hello world', fontSize: 24 };
    const previewSelection = { tagName: 'p', selector: '.lead', textContent: 'Hello world' };

    act(() => {
      result.current.setSelectedObject(objectSelection);
    });

    expect(result.current.selectedObject).toEqual(objectSelection);

    act(() => {
      result.current.setSelectedHTMLElement(previewSelection);
    });

    expect(result.current.selectedHTMLElement).toEqual(previewSelection);
    expect(result.current.selectedObject).toEqual(objectSelection);
  });
});
