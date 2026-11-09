/**
 * LaunchContext - Provides launch state across the app
 * 
 * Makes LaunchState (from prompt-first launch / launchOrchestrator) available to:
 * - WebBuilder (for preview configuration)
 * - VFSPreview (for Sandpack file generation)
 * - PromptLaunchPanel (handoff after a chat-created site)
 * - AI panels (for context about the current launch)
 * 
 * This context bridges the gap between multiple preview truths by providing
 * a single source for launch metadata and VFS files.
 */

import React, { useContext, useState, ReactNode } from 'react';
import type { LaunchState, LaunchContextType } from '@/types/launchState';
import { LaunchContext } from './LaunchContextDef';

// ============================================================================
// Provider Component
// ============================================================================

export interface LaunchProviderProps {
  children: ReactNode;
}

export const LaunchProvider: React.FC<LaunchProviderProps> = ({ children }) => {
  const [launch, setLaunchState] = useState<LaunchState | null>(null);

  const value: LaunchContextType = {
    launch,
    setLaunch: setLaunchState,
    updateLaunch: (updates) => {
      setLaunchState((prev) => (prev ? { ...prev, ...updates } : null));
    },
    isFreshLaunch: !!launch && !!launch.createdAt,
    clearLaunch: () => setLaunchState(null),
  };

  return (
    <LaunchContext.Provider value={value}>
      {children}
    </LaunchContext.Provider>
  );
};

export default LaunchContext;
