
it('lets users manually clear the headerless homepage conversation', () => {
  render(<AIAssistantCore
    appearance="unison"
    hideHeader
    allowClearHistory
    showFileUpload={false}
    initialMessages={[{ role: 'user', content: 'Keep this message?', timestamp: new Date(0) }]}
  />);

  expect(screen.getByText('Keep this message?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(screen.queryByText('Keep this message?')).not.toBeInTheDocument();
});
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AIAssistantCore } from '@/components/ai/AIAssistantCore';
import { SITE_CONFIRMATION_MARKER } from '@/components/ai/siteConfirmation';
import { siteDiscoveryMessagesKey } from '@/components/ai/siteDiscoveryPersistence';
import { invokeAIFunction } from '@/integrations/supabase/ai-client';

vi.mock('@/hooks/useAIFileAnalysis', () => ({ useAIFileAnalysis: () => ({ analyzing: false, analyzeAndGenerate: vi.fn() }) }));
vi.mock('@/integrations/supabase/ai-client', () => ({ invokeAIFunction: vi.fn() }));
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

it('lets users manually clear the headerless homepage conversation', () => {
  render(<AIAssistantCore
    appearance="unison"
    hideHeader
    allowClearHistory
    showFileUpload={false}
    initialMessages={[{ role: 'user', content: 'Keep this message?', timestamp: new Date(0) }]}
  />);

  expect(screen.getByText('Keep this message?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(screen.queryByText('Keep this message?')).not.toBeInTheDocument();
  expect(screen.getByText('Tell Affinity what you have in mind.')).toBeInTheDocument();
});

it('renders setup choices beneath discovery questions and submits answers into the same chat', async () => {
  vi.mocked(invokeAIFunction)
    .mockResolvedValueOnce({ data: { mode: 'site-discovery', content: 'What can visitors do on the site?' }, error: null } as never)
    .mockResolvedValueOnce({ data: { mode: 'site-discovery', content: 'Which pages do you need?' }, error: null } as never);
  render(<AIAssistantCore aiMode="site-discovery" showFileUpload={false} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'I run a salon.' } });
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
  expect(await screen.findByText('What can visitors do on the site?')).toBeInTheDocument();
  expect(screen.queryByText(/UNISON_WIZARD_STEP/)).not.toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Choose visitor actions' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Book a service' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send choices' }));
  expect(await screen.findByText('Which pages do you need?')).toBeInTheDocument();
  expect(vi.mocked(invokeAIFunction).mock.calls[1][1].messages).toContainEqual({
    role: 'user', content: 'Visitors should be able to Book a service.',
  });
  expect(screen.getByRole('group', { name: 'Choose pages' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('asks a missing required setup question before revealing the launch plan', () => {
  const onSiteConfirmed = vi.fn();
  render(<AIAssistantCore
    aiMode="site-discovery"
    appearance="unison"
    showFileUpload={false}
    initialMessages={[
      { role: 'user', content: 'I need a website for my business.', timestamp: new Date(0) },
      { role: 'assistant', content: `A website for your business. Does this look right? ${SITE_CONFIRMATION_MARKER}`, timestamp: new Date(1) },
    ]}
    onSiteConfirmed={onSiteConfirmed}
  />);

  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Yes, please!' } });
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: false });

  expect(onSiteConfirmed).not.toHaveBeenCalled();
  expect(screen.getByText('Before I finalize your plan, what is the main purpose of this site?')).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Describe the site purpose' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Site purpose' })).toBeInTheDocument();
});

it('keeps the discovery conversation when confirmation reveals inline selections', () => {
  function ChatHandoff() {
    const [brief, setBrief] = useState<string | null>(null);
    return <AIAssistantCore
      appearance="unison"
      showFileUpload={false}
      initialMessages={[
        { role: 'user', content: 'I need a salon website.', timestamp: new Date(0) },
        { role: 'assistant', content: `A salon website with booking. Does this look right? ${SITE_CONFIRMATION_MARKER}`, timestamp: new Date(0) },
      ]}
      onSiteConfirmed={setBrief}
      selectionActive={Boolean(brief)}
      conversationContent={brief ? <section aria-label="Inline selections">Choose your goals</section> : undefined}
    />;
  }
  render(<ChatHandoff />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Yes, please!' } });
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: false });
  expect(screen.getByRole('region', { name: 'Inline selections' })).toBeInTheDocument();
  expect(screen.getByText('I need a salon website.')).toBeInTheDocument();
  expect(screen.getByText('Yes, please!')).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('resumes an interrupted discovery conversation and opens selections after confirmation', async () => {
  const persistenceKey = siteDiscoveryMessagesKey('user-123');
  const onSiteConfirmed = vi.fn();
  function ResumableChat({ initialMessages = [] }: { initialMessages?: { role: 'user' | 'assistant'; content: string; timestamp: Date }[] }) {
    const [brief, setBrief] = useState<string | null>(null);
    return <AIAssistantCore
      key="resumable-chat"
      appearance="unison"
      showFileUpload={false}
      persistenceKey={persistenceKey}
      initialMessages={initialMessages}
      onSiteConfirmed={(value) => {
        onSiteConfirmed(value);
        setBrief(value);
      }}
      selectionActive={Boolean(brief)}
      conversationContent={brief ? <section aria-label="Resumed Wizard">Choose your goals</section> : undefined}
    />;
  }

  const firstPage = render(<ResumableChat initialMessages={[
    { role: 'user', content: 'I need a bakery website with online ordering.', timestamp: new Date(0) },
    { role: 'assistant', content: `A bakery site with online ordering and a warm visual style. Does that sound right? ${SITE_CONFIRMATION_MARKER}`, timestamp: new Date(1) },
  ]} />);
  await waitFor(() => expect(window.localStorage.getItem(persistenceKey)).toContain('SITE_CONFIRMATION'));
  firstPage.unmount();

  render(<ResumableChat />);
  expect(await screen.findByText('I need a bakery website with online ordering.')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Yes, please!' } });
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: false });

  expect(await screen.findByRole('region', { name: 'Resumed Wizard' })).toBeInTheDocument();
  expect(onSiteConfirmed).toHaveBeenCalledWith(expect.stringContaining('bakery site with online ordering'));
});

it('opens inline Wizard after a natural confirmation request and the user replies "ya"', () => {
  function ChatHandoff() {
    const [brief, setBrief] = useState<string | null>(null);
    return <AIAssistantCore
      appearance="unison"
      showFileUpload={false}
      initialMessages={[
        { role: 'user', content: 'I need a UI/UX designer portfolio.', timestamp: new Date(0) },
        { role: 'assistant', content: 'Great! Is that a complete and accurate summary of the website you want to build?', timestamp: new Date(1) },
      ]}
      onSiteConfirmed={setBrief}
      selectionActive={Boolean(brief)}
      conversationContent={brief ? <section aria-label="Inline selections">Choose your goals</section> : undefined}
    />;
  }

  render(<ChatHandoff />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ya' } });
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: false });

  expect(screen.getByRole('region', { name: 'Inline selections' })).toBeInTheDocument();
  expect(screen.getByText('ya')).toBeInTheDocument();
});

it('lets users create their site from the chat when AI failed to ask for confirmation', () => {
  const onContinueToWizard = vi.fn();
  function ChatHandoff() {
    const [brief, setBrief] = useState<string | null>(null);
    return <AIAssistantCore
      appearance="unison"
      showFileUpload={false}
      initialMessages={[
        { role: 'user', content: 'I need a portfolio with case studies and a booking calendar.', timestamp: new Date(0) },
        { role: 'assistant', content: 'What visual style would you like?', timestamp: new Date(1) },
      ]}
      onContinueToWizard={(value) => {
        onContinueToWizard(value);
        setBrief(value);
      }}
      selectionActive={Boolean(brief)}
      conversationContent={brief ? <section aria-label="Create from chat">Ready to create your site</section> : undefined}
    />;
  }

  render(<ChatHandoff />);
  fireEvent.click(screen.getByRole('button', { name: 'Create my site from this chat' }));

  expect(screen.getByRole('region', { name: 'Create from chat' })).toBeInTheDocument();
  expect(onContinueToWizard).toHaveBeenCalledWith(expect.stringContaining('case studies and a booking calendar'));
});
