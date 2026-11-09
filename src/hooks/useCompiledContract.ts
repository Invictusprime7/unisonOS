/**
 * useCompiledContract — Derives a CompiledContract from WebBuilder's navigation state.
 *
 * Sources (in priority order):
 * 1. Pre-compiled contract passed via location.state._compiledContract
 * 2. SystemsBuildContext → reverse-mapped to BusinessBlueprint → compiled
 * 3. Industry + systemType heuristic from nav state → compiled
 *
 * Returns null if no contract can be derived (e.g. free-form generation).
 */

import { useMemo } from 'react';
import {
  type CompiledContract,
  type CompileOptions,
  compileContract,
  createBlueprintFromIndustry,
  getIndustryForSystemType,
} from '@/platform/core';
import type { SystemsBuildContext } from '@/types/systemsBuildContext';
import type { BusinessSystemType } from '@/data/templates/types';

export interface ContractNavState {
  /** Pre-compiled contract (from BusinessLauncher) */
  _compiledContract?: CompiledContract;
  /** SystemsBuildContext (from prompt-first launch) */
  systemsBuildContext?: SystemsBuildContext;
  /** System type from launcher */
  systemType?: string;
  /** Template / business name */
  templateName?: string;
}

export function useCompiledContract(
  navState: ContractNavState | null,
  options: CompileOptions = {},
): CompiledContract | null {
  return useMemo(() => {
    if (!navState) return null;

    // 1. Pre-compiled contract (best case — already validated)
    if (navState._compiledContract) {
      return navState._compiledContract;
    }

    // 2. Derive from systemsBuildContext
    if (navState.systemsBuildContext) {
      const ctx = navState.systemsBuildContext;
      const industry = ctx.identity?.industry;
      const businessName = ctx.brand?.business_name || navState.templateName || 'My Business';

      if (industry) {
        try {
          const blueprint = createBlueprintFromIndustry(industry, businessName);
          return compileContract(blueprint, options);
        } catch (e) {
          console.warn('[useCompiledContract] Failed to compile from systemsBuildContext:', e);
        }
      }
    }

    // 3. Heuristic from systemType
    if (navState.systemType) {
      const profiles = getIndustryForSystemType(navState.systemType as BusinessSystemType);
      if (profiles.length > 0) {
        try {
          const blueprint = createBlueprintFromIndustry(
            profiles[0].industry,
            navState.templateName || 'My Business',
          );
          return compileContract(blueprint, options);
        } catch (e) {
          console.warn('[useCompiledContract] Failed to compile from systemType:', e);
        }
      }
    }

    return null;
  }, [navState, options]);
}
