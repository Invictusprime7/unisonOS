import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArchiveRestore, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { importUnisonSiteZip } from '@/services/export/importUnisonSiteZip';
import { persistGeneratedBindings } from '@/services/persistGeneratedBindings';
import { autoEmitSectionBindings } from '@/services/autoEmitSectionBindings';
import { persistLauncherHandoff } from '@/services/launcherHandoffPersistence';
import { commitMutation } from '@/services/vfsCommitService';
import { legacyFilesToPatchPlan } from '@/types/patchPlan';
import { createLaunchState } from '@/types/launchState';
import { cn } from '@/lib/utils';

interface ImportUnisonSiteZipButtonProps {
  businessId?: string | null;
  onImported?: () => void;
  className?: string;
}

export function ImportUnisonSiteZipButton({
  businessId,
  onImported,
  className,
}: ImportUnisonSiteZipButtonProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error('Choose a .zip exported from Unison');
      return;
    }
    if (!businessId) {
      toast.error('Choose a Business Profile before restoring an export.');
      return;
    }

    setIsImporting(true);
    try {
      const imported = await importUnisonSiteZip(file, {
        fallbackName: file.name.replace(/\.zip$/i, ''),
      });
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) throw new Error('Sign in before restoring a Unison export.');

      const restoredName = `${imported.projectName} (restored)`;
      const { data: draft, error: draftError } = await supabase
        .from('builder_drafts')
        .insert({
          user_id: user.id,
          business_id: businessId,
          name: restoredName,
          code: '',
          editor_code: '',
          vfs_files: {} as Json,
          metadata: {
            name: restoredName,
            projectName: restoredName,
            description: 'Reserved for a revision-backed Unison export restore',
            source: 'unison-zip-import',
            importedAt: new Date().toISOString(),
            industry: imported.industry,
            systemType: imported.systemType,
            entryPoint: imported.entryPoint,
            themePresetId: imported.themePresetId,
          } as unknown as Json,
        })
        .select('id, project_id')
        .single();
      if (draftError) throw draftError;
      if (!draft?.project_id) {
        throw new Error('The restored draft could not be linked to a Cloud project.');
      }

      const restore = await commitMutation({
        source: 'system-restore',
        identity: {
          userId: user.id,
          businessId,
          projectId: draft.project_id,
          draftId: draft.id,
          revisionId: '',
          sessionId: `unison-zip-import:${draft.id}`,
        },
        current: {
          vfsFiles: {},
          siteBundleSnapshot: imported.siteBundleSnapshot,
          playground: imported.canonicalPlayground as never,
          activePagePath: imported.entryPoint,
        },
        patch: legacyFilesToPatchPlan(imported.vfsFiles, `Restore ${imported.projectName} from Unison export`),
        options: {
          requirePreviewPass: true,
          requireReadinessPass: true,
          businessName: imported.projectName,
          industry: imported.industry,
          selectedTemplateId: imported.templateId,
          selectedThemeId: imported.themePresetId,
          themePresetId: imported.themePresetId,
          themeTokens: imported.siteBundleSnapshot.themeTokens,
        },
      });
      if (!restore.persistedRevisionId) {
        throw new Error('The restored site could not be recorded in the revision ledger.');
      }

      await Promise.allSettled([
        persistGeneratedBindings({
          businessId,
          projectId: draft.project_id,
          files: restore.vfsFiles,
        }),
        autoEmitSectionBindings({
          businessId,
          projectId: draft.project_id,
          snapshot: restore.siteBundleSnapshot as typeof imported.siteBundleSnapshot,
        }),
      ]);

      const routeState = {
        fromLauncher: true,
        fromUnisonImport: true,
        startInPreview: true,
        templateName: restoredName,
        templateCategory: 'landing' as const,
        templateId: imported.templateId,
        aesthetic: imported.themePresetId || 'imported',
        themePresetId: imported.themePresetId,
        systemType: imported.systemType,
        systemName: imported.systemName,
        businessId,
        projectId: draft.project_id,
        draftId: draft.id,
        entryPoint: imported.entryPoint,
        vfsFiles: restore.vfsFiles,
        runtimeManifest: restore.runtimeManifest as typeof imported.runtimeManifest,
        siteBundleSnapshot: restore.siteBundleSnapshot as typeof imported.siteBundleSnapshot,
        canonicalPlayground: restore.playground,
        revisionId: restore.persistedRevisionId,
        wizardSeed: imported.wizardSeed,
        preloadedIntents: imported.preloadedIntents,
        launchReliabilityMode: 'imported-unison-export',
      };
      const launchState = createLaunchState({
        systemType: imported.systemType,
        systemName: imported.systemName,
        businessName: imported.projectName,
        templateName: restoredName,
        templateCategory: 'landing',
        aesthetic: imported.themePresetId || 'imported',
        themePresetId: imported.themePresetId,
        templateId: imported.templateId,
        industry: imported.industry,
        preloadedIntents: imported.preloadedIntents,
        startInPreview: true,
        intentRuntime: true,
        businessId,
        projectId: draft.project_id,
        entryPoint: imported.entryPoint,
        vfsFiles: restore.vfsFiles,
        runtimeManifest: restore.runtimeManifest as typeof imported.runtimeManifest,
        siteBundleSnapshot: restore.siteBundleSnapshot as typeof imported.siteBundleSnapshot,
        materializedPlayground: restore.playground,
        wizardSeed: imported.wizardSeed,
      });

      persistLauncherHandoff({ routeState, launchState });
      if (imported.warnings.length > 0) {
        console.warn('[ImportUnisonSiteZip] import warnings', imported.warnings);
      }
      toast.success(`Restored ${imported.fileCount} files into Cloud preview.`);
      onImported?.();
      navigate('/web-builder', { replace: true, state: routeState });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[ImportUnisonSiteZip] restore failed', error);
      toast.error(`Restore failed: ${message}`);
    } finally {
      setIsImporting(false);
    }
  }, [businessId, navigate, onImported]);

  return (
    <button
      type="button"
      disabled={isImporting}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
        'border border-emerald-400/30 bg-emerald-500/[0.06] text-emerald-200 hover:border-emerald-300/60 hover:bg-emerald-500/[0.12]',
        isImporting && 'cursor-wait opacity-60',
        className,
      )}
      title="Restore an exported Unison project into this Business Profile"
    >
      {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArchiveRestore className="h-3.5 w-3.5" />}
      <span>{isImporting ? 'Restoring…' : 'Restore Unison export'}</span>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = '';
        }}
      />
    </button>
  );
}