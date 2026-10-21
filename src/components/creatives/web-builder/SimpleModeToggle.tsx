/**
 * Simple Mode Toggle - Clean, intuitive mode switcher with improved click response
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { MousePointer2, Eye } from 'lucide-react';

export type SimpleBuilderMode = 'select' | 'preview';

interface SimpleModeToggleProps {
  currentMode: SimpleBuilderMode;
  onModeChange: (mode: SimpleBuilderMode) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  hasSelection?: boolean;
  className?: string;
}

export const SimpleModeToggle: React.FC<SimpleModeToggleProps> = ({
  currentMode,
  onModeChange,
  className,
}) => {
  return (
    <div className={cn(
      "flex items-center",
      className
    )}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onModeChange('select')}
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          title="Edit mode"
          aria-label="Edit mode"
          aria-pressed={currentMode === 'select'}
        >
          <MousePointer2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => onModeChange('preview')}
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/55 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          title="Preview mode"
          aria-label="Preview mode"
          aria-pressed={currentMode === 'preview'}
        >
          <Eye className="h-4 w-4" />
        </button>
      </div>

      {/* Action Buttons - Disabled: use floating toolbar instead */}
      {/* Selection actions (duplicate/delete) are now handled by ElementFloatingToolbar */}
    </div>
  );
};

export default SimpleModeToggle;
