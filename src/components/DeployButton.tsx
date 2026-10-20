/**
 * DeployButton Component
 * 
 * One-click deployment button for VFS templates to Vercel/Netlify
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Rocket, ChevronDown, ExternalLink, Check, AlertCircle } from 'lucide-react';
import { useDeployment } from '@/hooks/useDeployment';
import { DeploymentProvider, wrapHtmlForDeployment } from '@/services/deploymentService';
import { toast } from 'sonner';
import {
  requireCanonicalSnapshot,
  isCanonicalRuntimeError,
} from '@/platform/core/canonicalRuntimeContract';
import GateVerdictStrip from '@/components/web-builder/GateVerdictStrip';
import PublishBlockersList from '@/components/web-builder/PublishBlockersList';
import type { CompiledContract, SiteBundleSnapshot } from '@/platform/core';
import { isPublishReady } from '@/platform/core';
import type { BusinessSystemType } from '@/data/templates/types';

interface DeployButtonProps {
  /** File map to deploy (path -> content) */
  files?: Record<string, string>;
  /** Lazily resolves deploy files so expensive bundle/export work never runs during shell render. */
  getFiles?: () => Record<string, string> | null | undefined;
  /** Default site name */
  defaultSiteName?: string;
  /** Callback when deployment completes */
  onDeployComplete?: (url: string) => void;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Show provider dropdown */
  showProviderSelect?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Compiled contract used to render the publish-time pre-flight gate strip. */
  contract?: CompiledContract | null;
  /**
   * Preferred publish source — the durable SiteBundleSnapshot produced by the
   * canonical pipeline. When supplied, `systemId` and vertical readiness
   * fixtures are read from `snapshot.meta` (not from UI state). Legacy
   * `systemId` prop remains only as a backwards-compat override.
   */
  snapshot?: SiteBundleSnapshot | null;
  /**
   * Track 6 — vertical system context.
   *
   * @deprecated Prefer `snapshot.meta.systemId`. Kept for callers that have
   * not yet been migrated to snapshot-driven publishing.
   */
  systemId?: BusinessSystemType | null;
  /**
   * Observed row counts by table (e.g. `{ products: 5 }`) used to evaluate
   * the vertical contract's `rowCountAssertions` server-side.
   */
  rowCounts?: Record<string, number>;
  /**
   * Move D — when supplied, the deploy refuses unless the latest
   * publish_ready=true revision exists in the durable ledger for this project.
   */
  projectId?: string | null;
}

export function DeployButton({
  files = {},
  getFiles,
  defaultSiteName,
  onDeployComplete,
  variant = 'default',
  size = 'default',
  showProviderSelect = true,
  disabled = false,
  contract = null,
  snapshot = null,
  systemId = null,
  rowCounts,
  projectId = null,
}: DeployButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [siteName, setSiteName] = useState(defaultSiteName || '');
  const [selectedProvider, setSelectedProvider] = useState<DeploymentProvider>('vercel');

  // Snapshot is the durable canonical source — fall back to legacy props only
  // when no snapshot is in scope (e.g. very early renders or non-builder hosts).
  const effectiveSystemId: BusinessSystemType | null =
    ((snapshot?.meta?.systemId as BusinessSystemType | null) ?? null) || systemId;

  const { deployToProvider, isDeploying, progress, message, result, reset } = useDeployment(
    'vercel',
    {
      onSuccess: (response) => {
        toast.success('Deployment successful!', {
          description: `Your site is live at ${response.url}`,
          action: response.url
            ? {
                label: 'Open',
                onClick: () => window.open(response.url, '_blank'),
              }
            : undefined,
        });
        if (response.url) {
          onDeployComplete?.(response.url);
        }
      },
      onError: (error) => {
        toast.error('Deployment failed', {
          description: error,
        });
      },
    }
  );

  const handleDeploy = async () => {
    const resolvedFiles = getFiles?.() ?? files;

    if (!resolvedFiles || Object.keys(resolvedFiles).length === 0) {
      toast.error('No files to deploy');
      return;
    }

    // Canonical runtime gate — launcher-backed drafts cannot deploy without a
    // valid SiteBundleSnapshot. Blank/manual drafts bypass this check.
    try {
      requireCanonicalSnapshot(resolvedFiles, 'deploy');
    } catch (err) {
      if (isCanonicalRuntimeError(err)) {
        toast.error('Deployment blocked by launch gate', {
          description: err.canonical.userMessage,
          action: {
            label: 'Run System Launcher',
            onClick: () => window.location.assign('/system-launcher'),
          },
        });
        return;
      }
      throw err;
    }

    const name = siteName.trim() || `unison-site-${Date.now()}`;
    
    // Process files to ensure proper HTML structure with Tailwind
    const processedFiles: Record<string, string> = {};
    for (const [path, content] of Object.entries(resolvedFiles)) {
      if (path.endsWith('.html') || path === 'index.html') {
        // Wrap HTML files with Tailwind CDN and proper structure
        processedFiles[path] = wrapHtmlForDeployment(content, name);
      } else {
        processedFiles[path] = content;
      }
    }
    
    await deployToProvider(selectedProvider, processedFiles, name, {
      contract,
      snapshot,
      systemId: effectiveSystemId,
      rowCounts,
      projectId,
    });
  };

  const handleOpenDialog = (provider: DeploymentProvider) => {
    setSelectedProvider(provider);
    setSiteName(defaultSiteName || '');
    reset();
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (!isDeploying) {
      setIsDialogOpen(false);
      reset();
    }
  };

  const fileCount = getFiles ? 1 : Object.keys(files || {}).length;
  const hasIndexHtml = getFiles ? true : !!(files && (files['index.html'] || files['/index.html']));

  return (
    <>
      {showProviderSelect ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={variant} size={size} disabled={disabled || fileCount === 0}>
              <Rocket className="h-4 w-4 mr-2" />
              Deploy
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleOpenDialog('vercel')}>
              <svg className="h-4 w-4 mr-2" viewBox="0 0 76 65" fill="currentColor">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
              </svg>
              Deploy to Vercel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleOpenDialog('netlify')}>
              <svg className="h-4 w-4 mr-2" viewBox="0 0 128 128" fill="currentColor">
                <path d="M85.255 85.26h-13.2l-.59-20.66-21.1-.59-.59 20.66-13.2-.59-.59-44.55 13.2.59.59 20.66 21.1.59-.59-20.07 13.2.59z" />
              </svg>
              Deploy to Netlify
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Button
          variant={variant}
          size={size}
          disabled={disabled || fileCount === 0}
          onClick={() => handleOpenDialog('vercel')}
        >
          <Rocket className="h-4 w-4 mr-2" />
          Deploy
        </Button>
      )}

      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Deploy to {selectedProvider === 'vercel' ? 'Vercel' : 'Netlify'}
            </DialogTitle>
            <DialogDescription>
              Deploy your template to a live URL in seconds.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Publish-time pre-flight: PreviewGate + PublishGate verdicts */}
            {!result && (
              <>
                <GateVerdictStrip contract={contract} compact />
                <PublishBlockersList contract={contract} />
              </>
            )}
            {!result && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="siteName">Site Name</Label>
                  <Input
                    id="siteName"
                    placeholder="my-awesome-site"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    disabled={isDeploying}
                  />
                  <p className="text-xs text-muted-foreground">
                    Your site will be available at {siteName || 'your-site'}.
                    {selectedProvider === 'vercel' ? 'vercel.app' : 'netlify.app'}
                  </p>
                </div>

                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="font-medium mb-1">Files to deploy:</p>
                  <p className="text-muted-foreground">
                    {fileCount} file{fileCount !== 1 ? 's' : ''}
                    {!hasIndexHtml && (
                      <span className="text-destructive ml-2">
                        ⚠️ Missing index.html
                      </span>
                    )}
                  </p>
                </div>

                {isDeploying && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-sm text-muted-foreground text-center">{message}</p>
                  </div>
                )}
              </>
            )}

            {result && result.status === 'success' && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-500">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Deployment successful!</span>
                </div>

                {result.url && (
                  <div className="space-y-2">
                    <Label>Live URL</Label>
                    <div className="flex gap-2">
                      <Input value={result.url} readOnly className="font-mono text-sm" />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => window.open(result.url, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {result.note && (
                  <p className="text-sm text-muted-foreground">{result.note}</p>
                )}
              </div>
            )}

            {result && result.status === 'error' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Deployment failed</span>
                </div>
                <p className="text-sm text-muted-foreground">{result.error}</p>
                {result.attestation?.enforced && result.attestation.code && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
                    <div className="font-medium text-destructive">
                      Server publish gate: {result.attestation.code}
                    </div>
                    <p className="opacity-80 mt-1">
                      The server re-verified the vertical readiness contract
                      and rejected this deploy. Fix the highlighted blocker(s)
                      and retry.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            {!result && (
              <>
                <Button variant="outline" onClick={handleCloseDialog} disabled={isDeploying}>
                  Cancel
                </Button>
                <Button
                  onClick={handleDeploy}
                  disabled={isDeploying || !hasIndexHtml || (contract ? !isPublishReady(contract) : false)}
                >
                  {isDeploying ? 'Deploying...' : 'Deploy'}
                </Button>
              </>
            )}
            {result && (
              <Button
                variant={result.status === 'success' ? 'default' : 'outline'}
                onClick={handleCloseDialog}
              >
                {result.status === 'success' ? 'Done' : 'Close'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DeployButton;
