/**
 * AIConversationWelcome — Empty-state welcome screen for AI Builder
 * Modern, conversational onboarding with contextual suggestions.
 */

import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  onSelectPrompt: (prompt: string) => void;
  templateName?: string | null;
  className?: string;
}

const SUGGESTIONS = ['Refine this page', 'Add a new page', 'Connect a button', 'Repair a preview error'];

export const AIConversationWelcome: React.FC<Props> = ({ onSelectPrompt, templateName, className }) => (
  <div className={cn('builder-welcome', className)}>
    <h3 className="text-foreground">{templateName || 'Your next change'}</h3>
    <div className="builder-welcome-actions">
      {SUGGESTIONS.map(prompt => <Button key={prompt} variant="link" onClick={() => onSelectPrompt(prompt)}><ArrowUpRight />{prompt}</Button>)}
    </div>
  </div>
);
