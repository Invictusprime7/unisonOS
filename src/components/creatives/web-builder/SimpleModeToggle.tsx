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
      {/* Mode Toggle - Pill Style */}
      <div className="flex items-center rounded-md bg-white/[0.035] p-0.5">
        <button
          onClick={() => onModeChange('select')}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors sm:gap-2 sm:px-3",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500",
            currentMode === 'select' 
              ? "bg-white/10 text-white" 
              : "text-white/40 hover:bg-white/[0.06] hover:text-white/80"
          )}
        >
          <MousePointer2 className="h-4 w-4" />
          <span>Edit</span>
          <kbd className={cn(
            "hidden lg:inline",
            "ml-1 px-1.5 py-0.5 text-[10px] rounded font-mono",
            currentMode === 'select' 
              ? "bg-black/30 text-black" 
              : "bg-lime-500/20 text-lime-400/60"
          )}>V</kbd>
        </button>

        <button
          onClick={() => onModeChange('preview')}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors sm:gap-2 sm:px-3",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500",
            currentMode === 'preview' 
              ? "bg-white/10 text-white" 
              : "text-white/40 hover:bg-white/[0.06] hover:text-white/80"
          )}
        >
          <Eye className="h-4 w-4" />
          <span>Preview</span>
          <kbd className={cn(
            "hidden lg:inline",
            "ml-1 px-1.5 py-0.5 text-[10px] rounded font-mono",
            currentMode === 'preview' 
              ? "bg-black/30 text-black" 
              : "bg-cyan-500/20 text-cyan-400/60"
          )}>P</kbd>
        </button>
      </div>

      {/* Action Buttons - Disabled: use floating toolbar instead */}
      {/* Selection actions (duplicate/delete) are now handled by ElementFloatingToolbar */}
    </div>
  );
};

export default SimpleModeToggle;
