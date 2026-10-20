import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AIConversationMessage } from '@/components/creatives/web-builder/ai-chat/AIConversationMessage';
import type { Message, ThinkingStep } from '@/components/creatives/web-builder/AIBuilderPanel';

afterEach(cleanup);

function showPipeline(steps: Array<Pick<ThinkingStep, 'type' | 'message'>>) {
  const message: Message = {
    id: 'status-test', role: 'assistant', content: 'Generated a candidate patch.',
    timestamp: new Date(),
    thinking: steps.map((step, index) => ({ ...step, id: String(index), timestamp: new Date() })),
  };
  render(<AIConversationMessage message={message} />);
  fireEvent.click(screen.getByRole('button', { name: /Thinking (interrupted|complete)/ }));
}

describe('AI conversation completion status', () => {
  it('preserves the save failure even if a legacy message ends with generation complete', () => {
    showPipeline([
      { type: 'generating', message: 'Calling AI model...' },
      { type: 'error', message: 'AI edit was not applied' },
      { type: 'complete', message: 'Generation complete' },
    ]);
    expect(screen.getByText('Last issue: AI edit was not applied')).toBeInTheDocument();
    expect(screen.queryByText('Last issue: Generation complete')).not.toBeInTheDocument();
    expect(screen.queryByText('Ready to apply changes.')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+ active/)).not.toBeInTheDocument();
  });

  it('shows the latest actual error when several stages fail', () => {
    showPipeline([
      { type: 'error', message: 'Validation failed' },
      { type: 'error', message: 'AI edit was not applied' },
      { type: 'complete', message: 'Generation complete' },
    ]);
    expect(screen.getByText('Last issue: AI edit was not applied')).toBeInTheDocument();
  });

  it('does not describe an already applied edit as ready to apply', () => {
    showPipeline([{ type: 'complete', message: 'Applied to /src/pages/Shop.tsx' }]);
    expect(screen.queryByText('Ready to apply changes.')).not.toBeInTheDocument();
    expect(screen.getAllByText('Applied to /src/pages/Shop.tsx')).toHaveLength(2);
  });
});
