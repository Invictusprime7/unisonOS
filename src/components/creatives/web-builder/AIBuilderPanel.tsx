import { resolvePreviewSource } from '@/services/editor/previewSourceResolver';
import { readAppBuilderAISettings, saveAppBuilderAISettings } from '@/services/app-builder/appBuilderAISettings';
import { clarifyBuilderRequest } from '@/services/builder/conversationalClarifier';
import { isThemeOnlyRequest } from '@/services/theme/themeEdit';
import { collectLocalImportClosure } from '@/services/laneBCompanionModules';
import { generateSiteImage, locateImageSource, isImageGenerationRequest, IMAGE_GENERATED_EVENT, SiteImageBusyError, SiteImageRequestError, type ImageGeneratedDetail } from '@/services/media/generateSiteImage';
/**
 * AIBuilderPanel - Enhanced AI interface for Web Builder
 * 
 * Features:
 * - Static left side panel (always visible when builder opens)
 * - Cascade output showing AI thinking process
 * - "View Edits" button to redirect to VFS changes
 * - Two tabs only: Code and Debug
 * - Debug tab for iframe error handling with Supabase access
 */

import { setAiGenerationActive } from '@/services/builder/builderMutationCoordinator';
import { buildRenderedSiteDigest } from '@/services/builder/renderedSiteDigest';
import { computeBuilderVfsSignature } from '@/services/builderStateRecovery';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Code2,
  Bug,
  Send,
  Sparkles,
  Loader2,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Eye,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Terminal,
  Database,
  FileCode,
  Trash2,
  Copy,
  Play,
  ExternalLink,
  Brain,
  Zap,
  Paperclip,
  ImageIcon,
  FileText,
  FileCode2,
  X,
  MessageSquare,
  CircleDot,
  Layers,
  Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AIConversationMessage } from './ai-chat/AIConversationMessage';
import { affinityReply } from './ai-chat/affinityReply';
import { AIConversationWelcome } from './ai-chat/AIConversationWelcome';
import { LaunchReadinessCard } from './ai-chat/LaunchReadinessCard';
import { AIConversationInput } from './ai-chat/AIConversationInput';
import { AgentActivityFeed } from './ai-chat/AgentActivityFeed';
import { BuilderSettings } from './ai-chat/BuilderSettings';
import './ai-chat/builder-interface.css';
import { BUILDER_FEATURE_KEY, BUILDER_FEATURE_DEFAULTS, readBuilderFeatures, requireBuilderFeature, builderAuthoringLane } from '@/services/builder/builderFeatures';
import { FileActivityRibbon } from './ai-chat/FileActivityRibbon';
import { emitAgentEvent, lineDelta } from '@/services/agent-runtime/agentEvents';
import { buildSystemGraph, renderSystemGraphForPrompt } from '@/services/agent-runtime/systemGraph';
import { AgentCommandPalette } from './ai-chat/AgentCommandPalette';
import { CatalogPanel } from './ai-chat/CatalogPanel';
import { dispatchBuilderOperation } from '@/services/unisonBuilderToolDispatch';
import { STALE_EDIT_PREFIX } from '@/services/builder/builderMutationCoordinator';
import { createUnisonBuilderContext, renderUnisonBuilderDirective } from '@/services/unisonBuilderConnector';
import { captureBuilderRequestState, assertBuilderRequestState, type BuilderRequestState } from '@/services/builder/builderRequestState';
import { renderCatalogForPrompt } from '@/services/agent-runtime/catalogOps';
import { parseResourceValueRequest } from '@/services/agent-runtime/resourceValueRequest';
import { parseResourceProvenance } from '@/services/resources/resourceRuntime';
import {
  discoverGeneratedSiteArtifacts,
  renderGeneratedSiteDiscoveryForPrompt,
  sourceTargetsForCartWiring,
} from '@/services/builder/generatedSiteDiscovery';
import { toast } from 'sonner';
import type { BusinessSystemType } from '@/data/templates/types';
import type { SystemsBuildContext } from '@/types/systemsBuildContext';
import { generateCanonicalDesignPrompt } from '@/sections/promptContext/canonicalDesignPrompt';
import { analyzeReactSite, resolveEditTarget, resolveEditSourceTargets } from '@/utils/reactSiteAnalysis';
import { resolveExplicitPageTarget, resolveRouteSourceFile, resolveLocalImports, type PageSourceTarget } from './previewRouteTabs';
import { buildComponentBehaviorMap, formatBehaviorMapForPrompt } from '@/services/aiVFSOrchestrator';
import { AIGatewayOptions, type GatewayConfig } from './AIGatewayOptions';
import { vfsEventBus } from '@/services/vfsEventBus';
import { diagnosticsAggregator } from '@/services/diagnosticsAggregator';
import { enhancePromptForAI, type AnalyzedPrompt } from '@/services/promptIntelligence';
import { DebugAgentPanel } from './DebugAgentPanel';
import { interpretPrompt, type TaskPlan } from '@/unison';
import { buildUnisonAIContext } from '@/unison/aiContext';
import type { PlanStepStatus } from '@/unison/nlTypes';
import {
  hydrateAIHistoryFromSupabase,
  loadAIHistory,
  setMessages as persistMessages,
  type PersistedMessage,
} from '@/services/aiHistoryStore';
// Side-effect import: registers GHL skill pack with global registry
import { isBuilderProviderUnavailable, isBuilderSessionError, releaseGuestDemoReservation, runBuilderTurn, shouldOfferBuilderProviderRetry } from '@/services/builderBrainClient';
import { resolveBuilderRegistryContext } from '@/services/builderRegistryContext';
import {
  envelopeRunIdFromResponse,
  recordRunOutcome,
} from '@/services/builderEnvelopeRuns';
import { buildCatalogContext, renderCatalogContextForPrompt } from '@/utils/catalogContext';
import { compileCatalogToolCalls, type RawToolCall } from '@/services/catalogToolExecutor';
import type { GeneratedUiManifest } from '@/platform/core/generatedUiFoundation';
import type { WizardDesignIntervention } from '@/services/wizardDesignIntervention';
import {
  applyAIBuilderFiles,
  type AIBuilderApplyCallback,
  type AIBuilderApplyMeta,
} from '@/services/aiBuilderApply';
import {
  CANDIDATE_GENERATED_NOTICE,
  CANDIDATE_PAGE_NOTICE,
  neutralizeModelSuccessClaim,
  transactionVerdictLine,
  savedUnconfirmedVerdictLine,
} from '@/services/builder/builderTransactionState';
import { awaitPreviewVerification, markPreviewPending } from '@/services/builder/previewVerification';
import {
  resolveCanonicalAuthoringPage,
} from '@/services/builder/canonicalAuthoringRequest';
import type { TopologyChange } from '@/services/pageTopologyOrchestrator';
import { buildAICandidateChangeSet, type AICandidateChangeSet } from '@/services/builder/aiCandidateChangeSet';
import { unisonAppBuilder } from '@/services/app-builder/UnisonAppBuilder';
import { deriveFilePath } from '@/services/routeNavigationService';
import { createBuilderPage } from '@/types/pageRegistry';
import { canonicalCandidateOutput } from '@/services/builder/canonicalCandidateOutput';
import {
  findUnrequestedCopyChanges,
  findUnrequestedScopedSideEffects,
  getUnrequestedNavigationSectionRemovalReason,
  isNavigationPresentationPrompt,
} from '@/services/builder/scopedEditContentGuard';

import {
  planBusinessCapabilities,
  type CapabilityPlan,
} from '@/services/businessCapabilityPlanner';
import { previewCapabilityMigration } from '@/services/capabilityMigrationRunner';
import { MigrationProposalPanel } from '@/components/ai-builder/MigrationProposalPanel';
import { LayoutSnapshotCard } from '@/components/creatives/web-builder/ai-chat/LayoutSnapshotCard';
import {
  interpretBuilderRequest,
  requiresRenderableUiPatch,
} from '@/services/builderRequestInterpreter';
import { uploadForPlacement, buildUploadPlacementBlock, CERTIFIED_VOCABULARY_NOTE, type PlacedUpload } from '@/services/assets/uploadPlacement';
import {
  AI_EDIT_PERMISSION_STORAGE_KEY,
  loadAIEditPermissions,
  type AIEditPermissionCategory,
  type AIEditPermissions,
} from './AIPermissionControl';

import {
  resolveCapabilityIntentBindings,
  type CapabilityIntentBindingResolution,
} from '@/services/capabilityIntentBindingResolver';

// ============================================================================
// Types
// ============================================================================

/**
 * Client-side scope guard — blocks auto-apply if a scoped edit
 * touches unauthorized files or creates too many new files.
 */
function getScopedEditAutoApplyBlockReason(opts: {
  files: Record<string, string>;
  originalFiles: Record<string, string>;
  prompt: string;
  resolvedTargetFile: string | null;
  existingFileKeys: string[];
  /** The target came from an element the user clicked in the Live Preview. */
  pinnedBySelection?: boolean;
  /** Visible text of the clicked element, when there is one. */
  targetText?: string | null;
}): string | null {
  const normalizePath = (p: string) => (p.startsWith('/') ? p : `/${p}`);
  const paths = Object.keys(opts.files).map(normalizePath);

  // A resolved target is a hard boundary for scoped auto-apply. The
  // resolver now follows the active page's imports so sibling section
  // components are resolved before this boundary is enforced.
  if (opts.resolvedTargetFile) {
    const normTarget = normalizePath(opts.resolvedTargetFile);
    if (!paths.includes(normTarget)) {
      return `Scoped edit resolved to ${normTarget} but the AI returned: ${paths.join(', ') || 'no files'}.`;
    }
    // A clicked element lives on exactly one page: never rewrite another
    // existing page while editing it.
    if (opts.pinnedBySelection) {
      const otherPages = paths.filter((path) => path !== normTarget
        && /^\/src\/pages\//.test(path)
        && opts.existingFileKeys.some((key) => normalizePath(key) === path)
        && opts.files[path] !== (opts.originalFiles[path] ?? opts.originalFiles[path.slice(1)]));
      if (otherPages.length > 0) {
        return `You selected something on ${normTarget}, but the AI also rewrote ${otherPages.join(', ')}.`;
      }
    }

    // Edit policy: added elements/components are advisory unless the user
    // explicitly narrowed the edit ("only", "just").
    const candidatePath = Object.keys(opts.files).find((path) => normalizePath(path) === normTarget);
    const original = opts.originalFiles[normTarget] ?? opts.originalFiles[opts.resolvedTargetFile];
    const candidate = candidatePath ? opts.files[candidatePath] : undefined;
    if (original && candidate && /\b(only|just)\b/i.test(opts.prompt)) {
      const sideEffects = findUnrequestedScopedSideEffects(original, candidate, opts.prompt);
      if (sideEffects.length > 0) {
        return `You asked for only this change, but the AI also added: ${sideEffects.join(', ')}.`;
      }
    }
  }

  // Collateral copy: a scoped edit may never rewrite visible text the request
  // did not cover — on the target file or any other existing file it touched.
  for (const [path, candidate] of Object.entries(opts.files)) {
    const normalized = normalizePath(path);
    if (!/\.(tsx|jsx)$/.test(normalized)) continue;
    const original = opts.originalFiles[normalized] ?? opts.originalFiles[normalized.slice(1)];
    if (typeof original !== 'string' || original === candidate) continue;
    const scopedText = opts.resolvedTargetFile && normalizePath(opts.resolvedTargetFile) === normalized
      ? opts.targetText
      : opts.pinnedBySelection ? '\u0000' : null;
    const removedCopy = findUnrequestedCopyChanges(original, candidate, opts.prompt, scopedText);
    if (removedCopy.length > 0) {
      const sample = removedCopy.slice(0, 2).map((value) => `"${value}"`).join(', ');
      return `The AI also changed text you didn't ask about in ${normalized} (${sample}${removedCopy.length > 2 ? ` and ${removedCopy.length - 2} more` : ''}).`;
    }
  }

  // File counts are not an execution boundary. A valid freeform edit may
  // touch routes, page bodies, hooks, and shared components in one commit.
  return null;

}

interface LaunchBriefPayload {
  productBrief: string;
  audience?: string;
  launchDate?: string;
  constraints?: string;
  availableAssets?: string;
}

const LAUNCH_PLANNING_KEYWORDS = [
  'launch plan',
  'release plan',
  'go-to-market plan',
  'gtm plan',
  'risk register',
  'owner checklist',
  'launch copy',
  'launch readiness',
];

function detectLaunchPlanningIntent(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  return LAUNCH_PLANNING_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

/** Catalog tools are for persisted catalog data, never source-level UI work. */
function isCatalogMutationRequest(prompt: string): boolean {
  const sourceEdit = /\b(?:nav(?:igation)?|menu|route(?:s|r)?|hashrouter|link(?:s|ing)?|redirect|hook|state|handler|component|section|typography|layout|cart|bag|checkout|button|form|wire|connect)\b/i;
  if (sourceEdit.test(prompt)) return false;
  const catalogEntity = /\b(?:service|product|menu item|price|pricing plan|offer|testimonial|portfolio)\b/i;
  const mutation = /\b(?:add|create|change|update|edit|remove|delete|sort|filter|limit)\b/i;
  return catalogEntity.test(prompt) && mutation.test(prompt);
}

function extractLaunchBriefFromPrompt(prompt: string): LaunchBriefPayload {
  const lines = prompt.split('\n').map((line) => line.trim()).filter(Boolean);
  const getLabeledValue = (labels: string[]): string | undefined => {
    const lowerLabels = labels.map((l) => l.toLowerCase());
    const hit = lines.find((line) => {
      const lower = line.toLowerCase();
      return lowerLabels.some((label) => lower.startsWith(`${label}:`));
    });
    if (!hit) return undefined;
    const idx = hit.indexOf(':');
    return idx >= 0 ? hit.slice(idx + 1).trim() : undefined;
  };

  const audience = getLabeledValue(['audience', 'target audience', 'users']);
  const launchDate = getLabeledValue(['launch date', 'release date', 'ship date']);
  const constraints = getLabeledValue(['constraints', 'limitations', 'blockers']);
  const availableAssets = getLabeledValue(['assets', 'available assets', 'materials']);

  return {
    productBrief: prompt,
    audience,
    launchDate,
    constraints,
    availableAssets,
  };
}

function formatLaunchPlanForBuilder(plan: unknown, fallbackContent: string): string {
  if (!plan || typeof plan !== 'object') {
    return fallbackContent;
  }

  const p = plan as {
    summary?: string;
    tasks?: Array<{ title?: string; priority?: string; owner?: string }>;
    readiness?: { score?: number; gaps?: string[] };
    riskRegister?: Array<{ title?: string; mitigation?: string }>;
    followUpQuestions?: string[];
  };

  const lines: string[] = [];

  if (p.summary) {
    lines.push('Launch Planning Summary');
    lines.push(p.summary);
  }

  if (p.readiness) {
    lines.push('');
    lines.push(`Readiness Score: ${typeof p.readiness.score === 'number' ? p.readiness.score : 0}/100`);
    const gaps = Array.isArray(p.readiness.gaps) ? p.readiness.gaps.slice(0, 4) : [];
    if (gaps.length > 0) {
      lines.push('Top Gaps:');
      gaps.forEach((gap) => lines.push(`- ${gap}`));
    }
  }

  const tasks = Array.isArray(p.tasks) ? p.tasks.slice(0, 8) : [];
  if (tasks.length > 0) {
    lines.push('');
    lines.push('Prioritized Tasks:');
    tasks.forEach((task) => {
      const pr = task.priority || 'P2';
      const owner = task.owner ? ` · ${task.owner}` : '';
      lines.push(`- [${pr}] ${task.title || 'Untitled task'}${owner}`);
    });
  }

  const risks = Array.isArray(p.riskRegister) ? p.riskRegister.slice(0, 5) : [];
  if (risks.length > 0) {
    lines.push('');
    lines.push('Risk Register:');
    risks.forEach((risk) => {
      const title = risk.title || 'Unnamed risk';
      const mitigation = risk.mitigation ? ` → Mitigation: ${risk.mitigation}` : '';
      lines.push(`- ${title}${mitigation}`);
    });
  }

  const followUps = Array.isArray(p.followUpQuestions) ? p.followUpQuestions.slice(0, 4) : [];
  if (followUps.length > 0) {
    lines.push('');
    lines.push('Follow-up Questions:');
    followUps.forEach((q) => lines.push(`- ${q}`));
  }

  const formatted = lines.join('\n').trim();
  return formatted || fallbackContent;
}


export interface ThinkingStep {
  id: string;
  type: 'analyzing' | 'planning' | 'generating' | 'validating' | 'complete' | 'error' | 'reasoning';
  message: string;
  timestamp: Date;
  details?: string;
  isExpanded?: boolean;
}

export interface MessageMeta {
  actionType?: string;
  modelUsed?: string;
  guestDemoOperationId?: string;
  filesDetected?: string[];
  warnings?: Array<{ severity: string; message: string }>;
  requiresApproval?: boolean;
  removedFiles?: string[];
  reviewSummary?: string;
  /** Affinity explained it cannot fulfill (part of) the request */
  outOfScope?: { reason: string; suggestedPatch?: string };
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  thinking?: ThinkingStep[];
  /** Raw extended-thinking text returned by Claude Sonnet 4.6 */
  claudeReasoning?: string;
  code?: string;
  edits?: VFSEdit[];
  error?: IframeError;
  isStreaming?: boolean;
  /** Unison TaskPlan for this message */
  taskPlan?: TaskPlan;
  /** Rich metadata from the AI response */
  meta?: MessageMeta;
  /** Inline question the AI asks; saved with the conversation. */
  ask?: { question: string; options: Array<{ label: string; reply: string }>; answer?: string };
}

export interface VFSEdit {
  path: string;
  type: 'create' | 'modify' | 'delete';
  linesChanged?: number;
  preview?: string;
}

export interface IframeError {
  type: 'runtime' | 'syntax' | 'network' | 'supabase';
  message: string;
  stack?: string;
  file?: string;
  line?: number;
  column?: number;
  timestamp: Date;
}

interface AIBuilderPanelProps {
  /** Theme lane: commits color/font/token changes as a canonical theme edit. */
  onRequestThemeEdit?: (prompt: string) => Promise<boolean>;
  currentCode?: string;
  systemType?: BusinessSystemType | null;
  templateName?: string | null;
  defaultTargetFile?: string | null;
  pageTargets?: PageSourceTarget[];
  onViewEdits?: (edits: VFSEdit[]) => void;
  /** Opens a project file in the code editor (used by the live file ribbon). */
  onOpenFile?: (path: string) => void;
  iframeErrors?: IframeError[];
  onClearErrors?: () => void;
  onClose?: () => void;
  /** Mount points for existing WebBuilder-owned panels; no duplicate mutations. */
  onToolsHostChange?: (host: HTMLDivElement | null) => void;
  onCustomizerHostChange?: (host: HTMLDivElement | null) => void;
  customizerAvailable?: boolean;
  className?: string;
  /** User's design profile for personalised AI generation */
  userDesignProfile?: {
    projectCount?: number;
    dominantStyle?: 'dark' | 'light' | 'colorful' | 'minimal' | 'mixed';
    industryHints?: string[];
  } | null;
  /** Structural summary of the current page (sections, elements) */
  pageStructureContext?: string | null;
  /** Current backend / Supabase integration state */
  backendStateContext?: string | null;
  /** Real business data (products, services, hours, etc.) */
  businessDataContext?: string | null;
  /** Structured business blueprint from systems-build (brand, palette, intents, sections) */
  systemsBuildContext?: SystemsBuildContext | null;
  /** Durable WizardSeed from launcher — forwarded with every Lane B turn for memory/route/theme/intent continuity. */
  wizardSeed?: Record<string, unknown> | null;
  /** Snapshot-owned UI imports and rules available to every Builder turn. */
  uiFoundation?: GeneratedUiManifest | null;
  /** Snapshot-owned deterministic layout, interaction, and motion choices. */
  designIntervention?: WizardDesignIntervention | null;
  /** Current VFS file list + dependency summary for AI awareness */
  vfsContext?: string | null;
  /** Full VFS file map for component-level site analysis */
  vfsFiles?: Record<string, string> | null;
  /** Canonical candidate apply callback, including presentation changes. */
  onApplyToVFS: AIBuilderApplyCallback;
  /** Preview handle ref for building component behavior maps (DOM inspection) */
  previewRef?: React.RefObject<{ getIframe?: () => HTMLIFrameElement | null } | null>;
  /** Active project id — used to scope persisted prompt + edit history. */
  projectId?: string | null;
  /** Currently accepted durable revision used as the Composer candidate base. */
  revisionId?: string | null;
  /** Read current canonical identity and VFS together, not a render-time closure. */
  getCurrentRequestState?: () => BuilderRequestState;
  /** Active business id — required for GHL fast-path bindings. */
  businessId?: string | null;
  /** Executes an explicitly approved, fully resolved business capability plan. */
  onApproveCapabilityPlan?: (
    plan: CapabilityPlan,
    resolution: CapabilityIntentBindingResolution,
  ) => Promise<{ success: boolean; error?: string }>;
  /**
   * Layout-intent fast path. When provided, the panel will pre-flight every
   * prompt through the deterministic layout intent engine (center / move /
   * align / reorder section / etc). Matched intents skip the LLM round-trip
   * entirely and apply via these callbacks.
   */
  layoutOps?: {
    /** Currently selected element selector from the floating toolbar (if any). */
    selectionSelector?: string | null;
    /** Section name guess for the current selection (e.g. "hero"). */
    selectionSection?: string | null;
    /** Apply a class-edit / section-reorder result. Returns true on success. */
    applyLayoutCode: (nextCode: string, summary: string) => boolean;
    /** Move the currently-selected element up among its siblings. */
    moveElementUp: () => void;
    /** Move the currently-selected element down among its siblings. */
    moveElementDown: () => void;
    /** Resolve a CSS-ish selector to JSX bounds in the current preview source. */
    findBounds: (jsx: string, selector: string) => { start: number; end: number } | null;
    /** Live preview source — required for deterministic mutations. */
    getPreviewCode: () => string;
  };
}

// ============================================================================
// Dropped File Type
// ============================================================================

interface DroppedFile {
  id: string;
  name: string;
  type: 'image' | 'text' | 'code' | 'other';
  /** Data URL for images, raw text for text/code */
  preview?: string;
  /** Full text content for text/code files */
  content?: string;
  size: number;
  /** Raw file, kept so it can be uploaded and placed on the site. */
  file?: File;
}

interface PendingPermissionAction {
  category: AIEditPermissionCategory;
  title: string;
  description: string;
  apply: () => Promise<boolean>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Old ThinkingStepItem and MessageItem components removed — replaced by ai-chat/ sub-components


// ============================================================================
// Main Component
// ============================================================================

export const AIBuilderPanel: React.FC<AIBuilderPanelProps> = ({
  onRequestThemeEdit,
  currentCode,
  systemType,
  templateName,
  defaultTargetFile,
  pageTargets = [],
  onViewEdits,
  onOpenFile,
  iframeErrors = [],
  onClearErrors,
  onClose,
  onToolsHostChange,
  onCustomizerHostChange,
  customizerAvailable = false,
  className,
  userDesignProfile,
  pageStructureContext,
  backendStateContext,
  businessDataContext,
  systemsBuildContext,
  wizardSeed,
  uiFoundation,
  designIntervention,
  vfsContext,
  vfsFiles,
  onApplyToVFS,
  previewRef,
  projectId,
  revisionId,
  getCurrentRequestState,
  businessId,
  onApproveCapabilityPlan,
  layoutOps,
}) => {
  // Hydrate persisted messages synchronously so a refresh never wipes history.
  const [messages, setMessages] = useState<Message[]>(() => {
    const persisted = loadAIHistory(projectId).messages;
    return persisted.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: new Date(m.timestamp),
      thinking: (m.thinking as ThinkingStep[] | undefined) || undefined,
      claudeReasoning: m.claudeReasoning,
      code: m.code,
      edits: (m.edits as VFSEdit[] | undefined) || undefined,
      taskPlan: (m.taskPlan as TaskPlan | undefined) || undefined,
      meta: (m.meta as MessageMeta | undefined) || undefined,
    }));
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    if (!isLoading) return;
    setAiGenerationActive(true);
    return () => setAiGenerationActive(false);
  }, [isLoading]);
  const [isFixing, setIsFixing] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'tools' | 'customize' | 'backend'>('code');
  useEffect(() => {
    if (!customizerAvailable && activeTab === 'customize') setActiveTab('code');
  }, [activeTab, customizerAvailable]);
  const [aiPermissions, setAIPermissions] = useState<AIEditPermissions>(() => loadAIEditPermissions());
  const [pendingPermissionAction, setPendingPermissionAction] = useState<PendingPermissionAction | null>(null);
  const [isApplyingPermissionAction, setIsApplyingPermissionAction] = useState(false);
  // Files the auto-apply guard held back. Without this the AI "resolved" a
  // rewrite that never materialized anywhere — now the user can still apply it.
  const [heldFiles, setHeldFiles] = useState<{ files: Record<string, string>; deletions?: string[]; routeOps?: TopologyChange[]; candidate?: AICandidateChangeSet; guestDemoOperationId?: string; reason: string } | null>(null);
  const [isApplyingHeld, setIsApplyingHeld] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<DroppedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [features, setFeatures] = useState(() => { try { return readBuilderFeatures(localStorage.getItem(BUILDER_FEATURE_KEY)); } catch { return { ...BUILDER_FEATURE_DEFAULTS }; } });
  const featuresRef = useRef(features);
  featuresRef.current = features;
  useEffect(() => { try { localStorage.setItem(BUILDER_FEATURE_KEY, JSON.stringify(features)); } catch { /* optional cache */ } }, [features]);
  const [gatewayConfig, setGatewayConfig] = useState<GatewayConfig | undefined>(readAppBuilderAISettings);
  const [pendingCapabilityProposal, setPendingCapabilityProposal] = useState<{
    plan: CapabilityPlan;
    resolution: CapabilityIntentBindingResolution;
    isApplying: boolean;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingPromptRef = useRef<string | null>(null);
  // Set when the owner confirms (via an inline answer) that they want the
  // real business setup, so the next request skips the uncertainty question.
  const confirmedSetupRef = useRef(false);
  const answerAsk = (messageId: string, option: { label: string; reply: string }, confirmsSetup: boolean) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId && m.ask ? { ...m, ask: { ...m.ask, answer: option.label } } : m)));
    if (!option.reply) return; // e.g. "Cancel": nothing to send
    confirmedSetupRef.current = confirmsSetup;
    pendingPromptRef.current = option.reply;
    setInput(option.reply);
  };

  // A save landed while the AI worked: offer to re-run the same request on the newest version.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant' || last.ask || !last.content?.startsWith(STALE_EDIT_PREFIX)) return;
    const prompt = [...messages].reverse().find((m) => m.role === 'user')?.content;
    if (!prompt) return;
    setMessages((prev) => prev.map((m) => (m.id === last.id ? {
      ...m,
      ask: { question: 'apply-on-latest', options: [
        { label: 'Apply on latest version', reply: prompt },
        { label: 'Cancel', reply: '' },
      ] },
    } : m)));
  }, [messages]);

  useEffect(() => {
    try {
      window.localStorage.setItem(AI_EDIT_PERMISSION_STORAGE_KEY, JSON.stringify(aiPermissions));
    } catch {
      // Permission state remains usable when storage is unavailable.
    }
  }, [aiPermissions]);

  const canAutoApply = useCallback((category: AIEditPermissionCategory) => aiPermissions[category], [aiPermissions]);
  // Full Auto: every category is on, so advisory holds (reviewer flags, scope
  // guard) never stop the AI. The canonical save gate and button-destination
  // checks still run on every write.
  const isFullAuto = aiPermissions.behavioral && aiPermissions.surgical && aiPermissions.ui && aiPermissions.backend;

  const queuePermissionReview = useCallback((action: PendingPermissionAction) => {
    setPendingPermissionAction(action);
    setActiveTab('code');
    toast.info(`${action.title} is ready for review`, {
      description: 'Change the AI permission to Auto or approve this patch below.',
    });
  }, []);

  const approvePendingPermissionAction = useCallback(async () => {
    if (!pendingPermissionAction || isApplyingPermissionAction) return;
    setIsApplyingPermissionAction(true);
    try {
      const applied = await pendingPermissionAction.apply();
      if (!applied) throw new Error('The change was rejected by the active VFS gate.');
      setPendingPermissionAction(null);
      toast.success('Reviewed AI change applied');
    } catch (error) {
      toast.error('Reviewed AI change was not applied', {
        description: error instanceof Error ? error.message : 'The VFS rejected the change.',
      });
    } finally {
      setIsApplyingPermissionAction(false);
    }
  }, [isApplyingPermissionAction, pendingPermissionAction]);

  // Auto-send when a welcome prompt is selected
  useEffect(() => {
    if (pendingPromptRef.current && input === pendingPromptRef.current && !isLoading) {
      pendingPromptRef.current = null;
      handleSend();
    }
  }, [input]);

  // Grounded prompts handed over by the Property Inspector — prefilled for review.
  useEffect(() => {
    const onBuilderPrompt = (event: Event) => {
      const prompt = (event as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (typeof prompt === 'string' && prompt.trim()) setInput(prompt);
    };
    window.addEventListener('unison:builder-prompt', onBuilderPrompt);
    return () => window.removeEventListener('unison:builder-prompt', onBuilderPrompt);
  }, []);

  // Click-to-target: an element picked in the preview scopes the next message.
  const [agentTarget, setAgentTarget] = useState<{
    tagName: string; text?: string; selector?: string; section?: string; intent?: string; revisionId?: string | null;
    scopeAncestors?: import('@/services/editScopeResolver').ScopeAncestors;
    editScope?: {
      scopeType: import('@/services/editScopeResolver').EditScopeType;
      targetId: string;
      selection: 'explicit' | 'auto';
    };
    provenance?: { sourceTable?: string | null; rowId?: string | null; field?: string | null; bindingId?: string | null; targetPath?: string | null; resource?: string | null };
    descriptor?: import('@/services/editor/editableObjectDescriptor').EditableObjectDescriptor;
  } | null>(null);
  useEffect(() => {
    const onTarget = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.tagName) setAgentTarget(detail);
    };
    window.addEventListener('unison:builder-target', onTarget);
    return () => window.removeEventListener('unison:builder-target', onTarget);
  }, []);


  const imageContextRef = useRef({ vfsFiles, projectId, businessId, revisionId, getCurrentRequestState, industry: systemType as string | null | undefined });
  imageContextRef.current = { vfsFiles, projectId, businessId, revisionId, getCurrentRequestState, industry: systemType as string | null | undefined };

  // Floating toolbar requests run through this same agent, scoped to the clicked element.
  useEffect(() => {
    const onBuilderSend = (event: Event) => {
      const detail = (event as CustomEvent<{ prompt?: string; target?: typeof agentTarget }>).detail;
      const prompt = detail?.prompt?.trim();
      if (!prompt) return;
      const t = detail?.target as (typeof agentTarget & { imageKind?: 'img' | 'background'; imageSelector?: string; imageSrc?: string; imageAlt?: string; width?: number; height?: number; forceImage?: boolean; placement?: 'background' | 'inside'; scrim?: 'light' | 'dark' | boolean; runs?: string[]; scope?: 'one' | 'group'; evidence?: string[]; ownerPath?: string; pagePath?: string }) | undefined;
      // Image extension: a picture request on an image runs through the AI Builder's
      // site-aware image step, then saves via the canonical image-replace path.
      if (t?.imageKind && (t.imageSelector || t.selector) && (t.forceImage || isImageGenerationRequest(prompt))) {
        if (!featuresRef.current.images) { toast.error('Turn on image generation in AI settings to continue.'); return; }
        const ctx = imageContextRef.current;
        const runId = `img-${Date.now().toString(36)}`;
        const idx = Number(t.descriptor?.instanceId);
        const where = t.scope === 'group' ? 'one picture shared by every card in this group'
          : Number.isFinite(idx) && t.descriptor?.instanceId != null ? `item ${idx + 1}` : undefined;
        // Elements without a picture: locate the owner by their text instead.
        const located = locateImageSource(ctx.vfsFiles, t.imageSrc, t.imageAlt ?? (t.placement ? String(t.text ?? '').slice(0, 60) : undefined));
        emitAgentEvent({ kind: 'understanding', runId, status: 'running', message: `Reading the site context for the ${t.section ? `${t.section} ` : ''}${t.placement === 'background' ? 'background' : 'image'}` });
        if (located.pagePath) emitAgentEvent({ kind: 'discovery', runId, status: 'ok', path: located.pagePath, message: `Found the ${t.placement ? 'element' : 'image'} in ${located.pagePath}` });
        emitAgentEvent({ kind: 'tool_call', runId, status: 'running', message: 'Writing the art direction and generating the image' });
        const id = toast.loading('Generating image…');
        void (async () => {
          const state = captureBuilderRequestState(ctx.getCurrentRequestState?.() ?? { files: ctx.vfsFiles ?? {}, revisionId: ctx.revisionId ?? null, projectId: ctx.projectId ?? null, businessId: ctx.businessId ?? null });
          const page = resolveCanonicalAuthoringPage(state.files, t.ownerPath ?? t.pagePath ?? located.pagePath);
          const registry = resolveBuilderRegistryContext({ vfsFiles: state.files, projectId: state.projectId, businessId: state.businessId, industry: ctx.industry, pageRole: page.role });
          const connector = createUnisonBuilderContext({ ...state, sourceTargets: [page.filePath], registryContext: registry, descriptor: t.descriptor, selection: { projectId: state.projectId, revisionId: t.revisionId, selector: t.imageSelector || t.selector, componentPath: page.filePath, clickedTag: t.tagName } });
          const source = await dispatchBuilderOperation(connector, state, 'inspect_file', page.filePath);
          const result = await generateSiteImage(prompt, {
            kind: t.imageKind ?? 'img', selector: t.imageSelector || t.selector, alt: t.imageAlt, currentSrc: t.imageSrc,
            nearbyText: t.text, section: t.section, repeatLabel: where, width: t.width, height: t.height,
          }, { projectId: state.projectId ?? undefined, businessId: state.businessId ?? undefined, industry: ctx.industry ?? undefined, pagePath: page.filePath, sourceSnippet: source ?? undefined, siteStyle: renderUnisonBuilderDirective(connector) });
          assertBuilderRequestState(state, ctx.getCurrentRequestState?.() ?? state);
          return { ...result, pagePath: page.filePath };
        })()
          .then(({ url, prompt: used, pagePath }) => {
            const imageSelector = t.imageSelector || t.selector;
            if (!imageSelector || !t.imageKind) return;
            window.dispatchEvent(new CustomEvent<ImageGeneratedDetail>(IMAGE_GENERATED_EVENT, { detail: { selector: imageSelector, src: url, kind: t.imageKind, currentSrc: t.imageSrc, alt: t.imageAlt, pagePath, placement: t.placement, scrim: t.scrim, text: t.text, evidence: t.evidence, ownerPath: t.ownerPath, tagName: t.tagName, runs: t.runs } }));
            emitAgentEvent({ kind: 'commit', runId, status: 'ok', message: 'Image generated — saving to your site' });
            setMessages((prev) => [...prev, { id: generateId(), role: 'assistant', content: `Made a new ${t.section ? `${t.section} ` : ''}image for you and saved it to the site.\n\nArt direction: ${used}`, timestamp: new Date() }]);
            toast.success('Image generated — saving to your site', { id });
          })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            // Nothing failed: a picture is genuinely still being made, so this
            // is a status note rather than a red error the user has to decode.
            if (err instanceof SiteImageBusyError) {
              emitAgentEvent({ kind: 'error', runId, status: 'failed', message: msg });
              toast.info(err.retryAfterSeconds ? 'The picture maker is cooling down' : 'One picture at a time', { id, description: msg });
              return;
            }
            emitAgentEvent({ kind: 'error', runId, status: 'failed', message: msg });
            // A refusal that states how long to wait is a hold, not a fault.
            if (err instanceof SiteImageRequestError && err.retryAfterSeconds) {
              toast.warning('The picture maker is busy', { id, description: msg });
              return;
            }
            toast.error('Could not generate the image', { id, description: msg });
          });
        return;
      }
      if (detail?.target?.tagName) setAgentTarget(detail.target);
      pendingPromptRef.current = prompt;
      setInput(prompt);
    };
    window.addEventListener('unison:builder-send', onBuilderSend);
    return () => window.removeEventListener('unison:builder-send', onBuilderSend);
  }, []);

  // ── File processing helpers ───────────────────────────────────────────────
  const classifyFile = (file: File): DroppedFile['type'] => {
    if (file.type.startsWith('image/')) return 'image';
    const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json', '.md', '.py', '.sql'];
    if (codeExts.some(ext => file.name.endsWith(ext))) return 'code';
    if (file.type.startsWith('text/')) return 'text';
    return 'other';
  };

  const processFile = useCallback((file: File): Promise<DroppedFile> => {
    return new Promise((resolve) => {
      const id = generateId();
      const fileType = classifyFile(file);
      if (fileType === 'image') {
        const reader = new FileReader();
        reader.onload = () => resolve({ id, name: file.name, type: 'image', preview: reader.result as string, size: file.size });
        reader.onerror = () => resolve({ id, name: file.name, type: 'image', size: file.size });
        reader.readAsDataURL(file);
      } else if (fileType === 'text' || fileType === 'code') {
        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result as string;
          resolve({ id, name: file.name, type: fileType, content: text, preview: text.slice(0, 500), size: file.size });
        };
        reader.onerror = () => resolve({ id, name: file.name, type: fileType, size: file.size });
        reader.readAsText(file);
      } else {
        resolve({ id, name: file.name, type: 'other', size: file.size });
      }
    });
  }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).slice(0, 5); // max 5 files
    const processed = (await Promise.all(arr.map(processFile))).map((p, i) => ({ ...p, file: arr[i] }));
    setDroppedFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      const newFiles = processed.filter(f => !existing.has(f.name));
      return [...prev, ...newFiles].slice(0, 5);
    });
  }, [processFile]);

  const removeFile = useCallback((id: string) => {
    setDroppedFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // Drag-and-drop handlers for the input zone
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      await addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Persist messages so a Preview / page refresh never loses prompt history.
  // Skip while a streaming assistant turn is in progress to avoid thrash —
  // we'll save on the next stable update.
  // Which draft the in-memory messages belong to. Persisting must never write
  // one draft's conversation under another draft's id during a switch.
  const messagesScopeRef = useRef<string | null | undefined>(projectId);
  useEffect(() => {
    if (messagesScopeRef.current !== projectId) return;
    const isStreaming = messages.some((m) => m.isStreaming);
    if (isStreaming) return;
    const persisted: PersistedMessage[] = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: (m.timestamp instanceof Date ? m.timestamp : new Date()).toISOString(),
      thinking: m.thinking as unknown,
      claudeReasoning: m.claudeReasoning,
      code: m.code,
      edits: m.edits as unknown,
      taskPlan: m.taskPlan as unknown,
      meta: m.meta as unknown,
    }));
    persistMessages(projectId, persisted);
  }, [messages, projectId]);

  // Re-hydrate when projectId changes (e.g. switching projects in builder).
  const lastProjectRef = useRef<string | null | undefined>(projectId);
  useEffect(() => {
    if (lastProjectRef.current === projectId) return;
    lastProjectRef.current = projectId;
    messagesScopeRef.current = projectId;
    const persisted = loadAIHistory(projectId).messages;
    setMessages(persisted.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: new Date(m.timestamp),
      thinking: (m.thinking as ThinkingStep[] | undefined) || undefined,
      claudeReasoning: m.claudeReasoning,
      code: m.code,
      edits: (m.edits as VFSEdit[] | undefined) || undefined,
      taskPlan: (m.taskPlan as TaskPlan | undefined) || undefined,
      meta: (m.meta as MessageMeta | undefined) || undefined,
    })));
  }, [projectId]);

  // Best-effort remote hydrate for cross-device continuity.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const hydrated = await hydrateAIHistoryFromSupabase(projectId);
      if (cancelled || messagesScopeRef.current !== projectId) return;
      setMessages(hydrated.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp),
        thinking: (m.thinking as ThinkingStep[] | undefined) || undefined,
        claudeReasoning: m.claudeReasoning,
        code: m.code,
        edits: (m.edits as VFSEdit[] | undefined) || undefined,
        taskPlan: (m.taskPlan as TaskPlan | undefined) || undefined,
        meta: (m.meta as MessageMeta | undefined) || undefined,
      })));
    })();
    return () => { cancelled = true; };
  }, [projectId]);

  // No initial welcome message — AIConversationWelcome handles the empty state

  useEffect(() => {
    setPendingCapabilityProposal((current) => {
      if (!current) return current;
      const resolution = resolveCapabilityIntentBindings(
        current.plan.proposal.intentBindings,
        vfsFiles ?? {},
      );
      return JSON.stringify(resolution) === JSON.stringify(current.resolution)
        ? current
        : { ...current, resolution };
    });
  }, [vfsFiles]);

  // Live thinking step pusher — updates the streaming message in real-time
  const pushThinkingStep = useCallback((
    streamingId: string,
    step: ThinkingStep,
    existingSteps: ThinkingStep[],
  ) => {
    existingSteps.push(step);
    setMessages(prev => prev.map(m =>
      m.id === streamingId ? { ...m, thinking: [...existingSteps] } : m
    ));
  }, []);

  // Send message to AI
  const handleSend = async () => {
    if ((!input.trim() && droppedFiles.length === 0) || isLoading) return;
    const guestDemoOperationId = crypto.randomUUID();
    try {
      if (isCatalogMutationRequest(input)) requireBuilderFeature(featuresRef.current, 'catalog');
      if (isImageGenerationRequest(input)) requireBuilderFeature(featuresRef.current, 'images');
      if (/\b(fix|repair|debug)\b/i.test(input)) requireBuilderFeature(featuresRef.current, 'repairs');
      if (/\b(wire|workflow|set it up for real|enable)\b/i.test(input)) requireBuilderFeature(featuresRef.current, 'capabilities');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'This AI feature is off.'); return; }
    queueMicrotask(() => emitAgentEvent({ kind: 'understanding', message: input.trim().slice(0, 140) || 'Reading your attached files' }));

    // Capture the selected entity before clearing the UI chip; the AI turn
    // resolves this immutable selection against the same graph revision.
    const selectedTarget = agentTarget;
    let requestState = captureBuilderRequestState(getCurrentRequestState?.() ?? imageContextRef.current.getCurrentRequestState?.() ?? { files: imageContextRef.current.vfsFiles ?? {}, revisionId: imageContextRef.current.revisionId ?? null, projectId: imageContextRef.current.projectId ?? null, businessId: imageContextRef.current.businessId ?? null });
    // Keep all downstream analysis and authoring on this one source/identity tuple.
    const { files: requestFiles, revisionId: requestRevision, projectId: requestProject, businessId: requestBusiness } = requestState;
    let vfsFiles = requestFiles;
    let revisionId = requestRevision;
    const projectId = requestProject;
    const businessId = requestBusiness;
    const ensureCurrentRequest = () => assertBuilderRequestState(requestState, getCurrentRequestState?.() ?? requestState);
    if (selectedTarget?.revisionId && selectedTarget.revisionId !== revisionId) {
      toast.error('This selection is from an older version. Select the element again.');
      return;
    }
    let streamingId: string | null = null;
    let globalTimeout: ReturnType<typeof setTimeout> | undefined;
    const originalRequest = input.trim();
    try {
    // Build file context suffix
    const targetContext = agentTarget
      ? `\n\n[Target element — apply this request to it only: <${agentTarget.tagName}>${agentTarget.text ? ` "${agentTarget.text}"` : ''}${agentTarget.section ? ` in section "${agentTarget.section}"` : ''}${agentTarget.scopeAncestors?.pagePath ? ` on the page at route "${agentTarget.scopeAncestors.pagePath}" (edit only that page's source)` : ''}${agentTarget.selector ? ` (selector ${agentTarget.selector})` : ''}${agentTarget.intent ? `; its button action "${agentTarget.intent}" and destination must stay unchanged` : ''}${agentTarget.provenance?.sourceTable && agentTarget.provenance.rowId ? `; canonical data owner ${agentTarget.provenance.sourceTable}/${agentTarget.provenance.rowId}${agentTarget.provenance.field ? ` field ${agentTarget.provenance.field}` : ''}` : ''}${agentTarget.provenance?.resource ? `; its value comes from saved record ${agentTarget.provenance.resource} — keep the data-ut-resource mark and do not hardcode a new value in place of the record` : ''}${agentTarget.provenance?.bindingId ? `; binding ${agentTarget.provenance.bindingId}` : ''}${agentTarget.provenance?.targetPath ? `; link target ${agentTarget.provenance.targetPath}` : ''}${agentTarget.descriptor?.ownerKind === 'source' && agentTarget.descriptor.instanceId != null ? `; it is repeat #${agentTarget.descriptor.instanceId + 1} of a repeated item — change only that instance, not its siblings` : ''}]`
      : '';
    setAgentTarget(null);
    const fileContext = targetContext + (droppedFiles.length > 0 ? (() => {
      const parts: string[] = [];
      for (const f of droppedFiles) {
        if (f.type === 'image') {
          parts.push(`\n\n[Attached image: ${f.name} — apply relevant visuals/style from this image to the design]`);
        } else if (f.content) {
          parts.push(`\n\n[Attached file: ${f.name}]\n\`\`\`\n${f.content.slice(0, 4000)}${f.content.length > 4000 ? '\n// ...truncated...' : ''}\n\`\`\``);
        }
      }
      return parts.join('');
    })() : '');

    // Upload attached files so the AI can place them on the site by URL.
    let uploadBlock = '';
    if (droppedFiles.some((f) => f.file)) {
      const placed: PlacedUpload[] = [];
      for (const f of droppedFiles) {
        if (!f.file) continue;
        try {
          emitAgentEvent({ kind: 'understanding', message: `Uploading ${f.name}` });
          const up = await uploadForPlacement(f.file, projectId);
          placed.push(f.content ? { ...up, text: f.content } : up);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Couldn't upload ${f.name}`);
        }
      }
      uploadBlock = buildUploadPlacementBlock(placed, systemType ?? null);
    }
    const placementContext = uploadBlock + CERTIFIED_VOCABULARY_NOTE;

    // Build attachments for the edge function
    const attachments = droppedFiles
      .filter(f => f.type === 'image' && f.preview)
      .flatMap(f => f.preview ? [{ name: f.name, type: 'image', data: f.preview }] : []);

    const userContent = input.trim() || `Analyse the attached file${droppedFiles.length > 1 ? 's' : ''} and incorporate them into the design.`;
    const isLaunchPlanningRequest = droppedFiles.length === 0 && detectLaunchPlanningIntent(userContent);
    const displayContent = userContent + (droppedFiles.length > 0 ? `\n📎 ${droppedFiles.length} file${droppedFiles.length > 1 ? 's' : ''} attached` : '');

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: displayContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setDroppedFiles([]);
    setIsLoading(true);
    // Record-backed value: a clicked price/name carrying a data-ut-resource mark
    // is changed on the saved record (ResourceRuntime), never in page code.
    const resourceMark = selectedTarget?.provenance?.resource;
    if (resourceMark && droppedFiles.length === 0 && businessId) {
      const ref = parseResourceProvenance(resourceMark);
      const value = ref ? parseResourceValueRequest(userContent, ref.field) : null;
      if (ref && value !== null) {
        try {
          requireBuilderFeature(featuresRef.current, 'catalog');
          ensureCurrentRequest();
          const agentCtx = { features: featuresRef.current, files: vfsFiles ?? {}, businessId, projectId: projectId ?? undefined, revisionId };
          const connector = createUnisonBuilderContext({
            projectId: projectId ?? null,
            businessId, revisionId,
            selection: { resourceMark, componentPath: defaultTargetFile ?? undefined },
          });
          const { summary } = await dispatchBuilderOperation(connector, agentCtx, 'update_resource_field', resourceMark, value);
          setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: `${summary}. The page shows the saved record, so its layout and buttons are unchanged.`, timestamp: new Date() }]);
          toast.success(summary);
        } catch (error) {
          setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: error instanceof Error ? error.message : 'That record could not be saved.', timestamp: new Date() }]);
        } finally { setIsLoading(false); }
        return;
      }
    }

    // Conversational first step: open-ended requests get concrete Unison
    // options instead of a guess; the chosen reply is itself a clear request.
    const clarification = clarifyBuilderRequest(userContent, {
      hasSelection: Boolean(selectedTarget),
      hasAttachments: droppedFiles.length > 0,
    });
    if (clarification) {
      setMessages(prev => [...prev, {
        id: generateId(), role: 'assistant', content: clarification.question, timestamp: new Date(),
        ask: { question: 'design-direction', options: clarification.options },
      }]);
      setIsLoading(false);
      return;
    }

    // Colors, fonts and theme tokens go through the theme lane (the page
    // authoring lane may not write the stylesheet). Mixed requests apply the
    // theme part first, then continue with the layout/content part.
    const themeOnly = isThemeOnlyRequest(userContent);
    // "primary"/"accent" alone are not theme words ("make the primary button
    // say Book now"); they count only next to a color word.
    const themeCue = /\b(colou?rs?|palette|(?:primary|accent)\s+(?:colou?r|hue|shade|tone)|font|typeface|typography|headings? font|rounder|corners|darker|lighter)\b/i.test(userContent);
    let themeApplied = false;
    if (onRequestThemeEdit && droppedFiles.length === 0 && (themeOnly || themeCue)) {
      try {
        emitAgentEvent({ kind: 'tool_call', message: 'Updating theme colors and fonts', status: 'running' });
        themeApplied = await onRequestThemeEdit(userContent);
        if (themeApplied) emitAgentEvent({ kind: 'commit', message: 'Theme saved', status: 'ok' });
      } catch (error) {
        if (themeOnly) {
          setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: `I couldn't apply that theme change: ${error instanceof Error ? error.message : 'unknown error'}. Tell me the color or font you want and I'll try again.`, timestamp: new Date() }]);
          setIsLoading(false);
          return;
        }
      }
      if (themeApplied && !themeOnly) {
        // The theme part of this request was just saved as a new revision by
        // this same request. Continue the layout/content part on top of it
        // instead of refusing it as "the site changed".
        const latest = getCurrentRequestState?.() ?? imageContextRef.current.getCurrentRequestState?.();
        if (latest && latest.projectId === requestState.projectId && latest.businessId === requestState.businessId) {
          requestState = captureBuilderRequestState(latest);
          vfsFiles = requestState.files;
          revisionId = requestState.revisionId;
        }
      }
      if (themeOnly && themeApplied) {
        setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: 'Done — the theme is updated across the site. Want me to adjust contrast or try a matching font pairing next?', timestamp: new Date() }]);
        setIsLoading(false);
        return;
      }
    }

    // Milestone 5 / Step 1: classification is envelope-driven. The interpreter
    // is authoritative; local hints are only used when it is unavailable.
    const capabilityInterpretation = await interpretBuilderRequest(userContent, {
      vertical: systemType ?? undefined,
      filePaths: Object.keys(vfsFiles ?? {}),
      pageTargets,
      currentPageId: selectedTarget?.scopeAncestors?.pageId
        ?? pageTargets?.find((page) => page.filePath === defaultTargetFile)?.pageId,
      currentPagePath: selectedTarget?.scopeAncestors?.pagePath
        ?? pageTargets?.find((page) => page.filePath === defaultTargetFile)?.route,
      selectedElement: selectedTarget ? {
        selector: selectedTarget.selector,
        text: selectedTarget.text,
        tagName: selectedTarget.tagName,
        pageId: selectedTarget.scopeAncestors?.pageId,
        pagePath: selectedTarget.scopeAncestors?.pagePath,
        sectionId: selectedTarget.scopeAncestors?.sectionId,
        sectionType: selectedTarget.scopeAncestors?.sectionType,
        blockId: selectedTarget.scopeAncestors?.blockId,
        slotId: selectedTarget.scopeAncestors?.slotId,
        sourceLocator: selectedTarget.scopeAncestors?.sourceLocator,
        resourceMark: selectedTarget.provenance?.resource,
        targetPath: selectedTarget.scopeAncestors?.targetPath,
        intent: selectedTarget.intent,
      } : null,
      selectedEditScope: selectedTarget?.editScope ?? null,
      hasExistingTemplate: Object.keys(vfsFiles ?? {}).length > 0,
      recentTurns: messages.filter(m => !m.isStreaming && (m.role === 'user' || m.role === 'assistant') && m.content.trim()).map(m => ({ role: m.role, content: m.content })),
    });

    const capabilityPlan = planBusinessCapabilities({
      requestId: generateId(),
      prompt: userContent,
      interpretation: capabilityInterpretation.degraded ? null : capabilityInterpretation.envelope,
      scope: 'business-system',

      context: {
        businessId: businessId ?? undefined,
        projectId: projectId ?? undefined,
        industry: systemType ?? undefined,
      },
    });
    const needsRenderableUiPatch = requiresRenderableUiPatch(
      capabilityInterpretation.envelope,
      userContent,
    );
    let backendAutoApplied = false;
    const setupConfidence = capabilityInterpretation.degraded ? 0 : (capabilityInterpretation.envelope?.confidence ?? 0);
    const setupConfirmed = confirmedSetupRef.current;
    confirmedSetupRef.current = false;
    if (features.capabilities && capabilityPlan.requestedCapabilities.length > 0 && !setupConfirmed && setupConfidence < 0.7) {
      const what = capabilityPlan.packs.map((pack) => pack.name).join(', ') || 'this feature';
      setMessages((prev) => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `Quick check before I build: do you want ${what} to actually work (saving real requests for you), or just the look of it for now?`,
        timestamp: new Date(),
        ask: {
          question: 'setup-or-design',
          options: [
            { label: 'Make it work for real', reply: `Set it up for real: ${userContent}` },
            { label: 'Just the design', reply: `Design only, no business setup: ${userContent}` },
          ],
        },
      }]);
      setIsLoading(false);
      return;
    }
    const designOnly = /^Design only, no business setup:/i.test(userContent);
    if (features.capabilities && capabilityPlan.requestedCapabilities.length > 0 && !designOnly) {
      const resolution = resolveCapabilityIntentBindings(
        capabilityPlan.proposal.intentBindings,
        vfsFiles ?? {},
      );
      const canApplyBackend = canAutoApply('backend')
        && resolution.unresolved.length === 0
        && !!onApproveCapabilityPlan;
      if (canApplyBackend) {
        setPendingCapabilityProposal({ plan: capabilityPlan, resolution, isApplying: true });
        ensureCurrentRequest();
        const outcome = await onApproveCapabilityPlan?.(capabilityPlan, resolution);
        if (!outcome) throw new Error('Capability approval is unavailable.');
        if (outcome.success) {
          backendAutoApplied = true;
          toast.success('Backend capability applied automatically');
          setPendingCapabilityProposal(null);
        } else {
          setPendingCapabilityProposal({ plan: capabilityPlan, resolution, isApplying: false });
          toast.error('Backend capability needs review', { description: outcome.error });
        }
      } else {
        setPendingCapabilityProposal({ plan: capabilityPlan, resolution, isApplying: false });
      }
      if (needsRenderableUiPatch) {
        toast.info(canApplyBackend
          ? 'Backend setup applied. Building the requested UI now.'
          : 'Building the design now. Tap “Turn on” in the chat when you want it to work for real.');
      } else {
        setMessages((prev) => [...prev, {
          id: generateId(),
          role: 'assistant',
          content: backendAutoApplied
            ? `${capabilityPlan.proposal.summary}\n\nBackend permission allowed this change to run automatically.`
            : capabilityPlan.proposal.summary,
          timestamp: new Date(),
        }]);
        setIsLoading(false);
        return;
      }
    }

    const _fileContext = fileContext + placementContext;
    const _attachments = attachments;
    const _userContent = userContent;
    const launchBrief = isLaunchPlanningRequest ? extractLaunchBriefFromPrompt(_userContent) : undefined;
      const thinkingSteps: ThinkingStep[] = [];
      streamingId = generateId();
      
      // Add streaming message immediately (visible with empty thinking)
      setMessages(prev => [...prev, {
        id: streamingId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        thinking: [],
        isStreaming: true,
      }]);

      // Helper to push a live step
      const liveStep = (type: ThinkingStep['type'], message: string, details?: string) => {
        pushThinkingStep(streamingId, {
          id: generateId(),
          type,
          message,
          timestamp: new Date(),
          details,
        }, thinkingSteps);
      };

      // ── Phase 1: Prompt Intelligence ──
      liveStep('analyzing', 'Parsing natural language request...');

      const rawInput = _userContent;
      const { enhancedPrompt: intelligentPrompt, analysis: promptAnalysis, isSurgical: detectedSurgical, isBehavioral: detectedBehavioral, isFullGen: isFullGeneration, isDebug: detectedDebug } = enhancePromptForAI(rawInput);
      if (detectedDebug) requireBuilderFeature(featuresRef.current, 'repairs');
      const isSurgicalEdit = detectedSurgical && !!currentCode;
      const isRouteWiringRequest = /\b(?:route|routing|router|navigate|redirect|href|active\s+(?:nav|menu|link)|nav(?:bar)?\s+(?:link|item)s?|menu\s+(?:link|item)s?)\b/i.test(rawInput);
      const isBehavioralEdit = (detectedBehavioral || isRouteWiringRequest) && !!currentCode;
      const isDebugMode = detectedDebug && !!currentCode;
      const isThemeEdit = promptAnalysis.intent === 'restyle' || promptAnalysis.secondaryIntents.includes('restyle');
      const isImageEdit = /\b(add|insert|include|place|replace|swap|change|generate|create|use)\b[\s\S]{0,80}\b(image|images|photo|photos|picture|pictures|visual|visuals)\b/i.test(rawInput);

      liveStep('analyzing', `Intent: ${promptAnalysis.intent} · Complexity: ${promptAnalysis.complexity}`, [
        promptAnalysis.targets.length ? `Targets: ${promptAnalysis.targets.map(t => t.section || t.element || t.file).filter(Boolean).join(', ')}` : null,
        promptAnalysis.designKeywords.length ? `Design cues: ${promptAnalysis.designKeywords.join(', ')}` : null,
        promptAnalysis.constraints.length ? `${promptAnalysis.constraints.length} constraints detected` : null,
        isBehavioralEdit ? '🧠 Behavioral edit mode' : isDebugMode ? '🔧 Debug mode' : isSurgicalEdit ? '🎯 Surgical edit mode' : isFullGeneration ? '🏗️ Full generation mode' : null,
      ].filter(Boolean).join(' | '));

      // Log prompt analysis for debugging
      console.log('[AIBuilderPanel] Prompt analysis:', {
        intent: promptAnalysis.intent,
        secondary: promptAnalysis.secondaryIntents,
        complexity: promptAnalysis.complexity,
        targets: promptAnalysis.targets.length,
        constraints: promptAnalysis.constraints.length,
        designKeywords: promptAnalysis.designKeywords,
        isSurgical: isSurgicalEdit,
        isBehavioral: isBehavioralEdit,
        isDebug: isDebugMode,
      });

      // ── Phase 1b: Unison Task Interpretation ──
      liveStep('analyzing', 'Reading your request and the current site...');
      
      const projectContext: import('@/unison').ProjectContext = {
        provisionedCapabilities: [],
        existingFiles: vfsFiles ? Object.keys(vfsFiles) : [],
        existingPages: [],
        builderMode: currentCode ? 'edit' : 'generate',
        hasBusinessId: !!systemsBuildContext?.brand?.business_name,
        installedWorkflows: [],
      };
      
      const { plan: taskPlan, feedback: unisonFeedback } = interpretPrompt(_userContent, projectContext);
      const unisonContext = buildUnisonAIContext(taskPlan);
      
      // Interpretation feeds the AI's context only; reasoning is shown as thinking steps, not a task list.
      liveStep('analyzing', 'Working out what needs to change');
      
      // Helper: advance TaskPlan step statuses in-place and update the message
      const advancePlanStep = (plan: TaskPlan, stepType: string, status: PlanStepStatus) => {
        const step = plan.steps.find(s => s.type === stepType && s.status !== 'done');
        if (step) {
          step.status = status;
          if (status === 'running') step.startedAt = new Date().toISOString();
          if (status === 'done' || status === 'failed') step.completedAt = new Date().toISOString();
        }
      };

      // Mark initial steps as running
      advancePlanStep(taskPlan, 'analyze', 'running');

      console.log('[AIBuilderPanel] Unison plan:', {
        route: taskPlan.route,
        steps: taskPlan.steps.length,
        complexity: taskPlan.estimatedComplexity,
        confidence: taskPlan.intent.confidence,
        outcome: unisonFeedback.outcome,
      });


      // Analyze VFS site structure for component-level targeting
      let siteAnalysisContext = '';
      let editTargetContext = '';
      let resolvedTargetFile: string | null = null;
      let selectionPinnedFile: string | null = null;
      let resolvedSourceTargets: string[] = [];
      const requestedPageTarget = resolveExplicitPageTarget(rawInput, pageTargets);
      let visiblePageFile = requestedPageTarget?.filePath ?? defaultTargetFile;
      if (!requestedPageTarget) {
        try {
          const route = previewRef?.current?.getIframe?.()?.contentWindow?.location.hash;
          if (route) visiblePageFile = resolveRouteSourceFile(vfsFiles, route.replace(/^#/, '')) ?? visiblePageFile;
        } catch { /* The host's active page remains authoritative for cross-origin previews. */ }
      }
      let isReactProject = false;
      if (vfsFiles && Object.keys(vfsFiles).length > 0) {
        // Detect if the VFS project is React-based (has .tsx/.jsx component files)
        const vfsPaths = Object.keys(vfsFiles);
        isReactProject = vfsPaths.some(p => /\.(tsx|jsx)$/.test(p) && !/\.d\.ts$/.test(p));
        
        // A clicked element pins the edit to the page the user actually sees:
        // its route maps through the canonical router to one source file, then
        // to the shared component that renders the clicked text, if any.
        let selectedSourceFile: string | null = null;
        if (selectedTarget) {
          const pageRoute = selectedTarget.scopeAncestors?.pagePath ?? null;
          const pageFile = resolveRouteSourceFile(vfsFiles, pageRoute);
          if (pageFile) {
            const locator = selectedTarget.descriptor?.sourceLocator ?? selectedTarget.scopeAncestors?.sourceLocator;
            // P2: resolve the click to its exact source node and owner; refuse
            // protected or stale targets instead of guessing another file.
            const resolution = locator ? resolvePreviewSource({ locator, files: vfsFiles, pagePath: pageFile }) : null;
            if (resolution?.reason === 'protected-owner') throw new Error('This part is managed by Unison and cannot be edited directly. Select the page content instead.');
            if (resolution?.reason === 'node-missing') throw new Error('The selected element changed since the preview loaded. Refresh the preview and reselect it.');
            const owner = resolution?.ownerPath ?? locator?.match(/^(\/[^:]+\.(?:tsx|jsx))(?::|$)/)?.[1];
            const needle = (selectedTarget.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
            const contains = (file: string) => Boolean(needle) && (vfsFiles[file] ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').includes(needle);
            const matches = [pageFile, ...resolveLocalImports(vfsFiles, pageFile)].filter(contains);
            if (!owner && matches.length > 1) throw new Error('This text appears in several components. Reselect it so its source can be identified safely.');
            if (owner && !vfsFiles[owner]) throw new Error('The selected source is no longer available. Refresh the preview and reselect the text.');
            selectedSourceFile = owner ?? matches[0] ?? pageFile;
            selectionPinnedFile = selectedSourceFile;
          }
        }
        {
          const analysis = analyzeReactSite(vfsFiles);
          if (analysis.sectionMap) {
            siteAnalysisContext = analysis.sectionMap;
          }
          // For surgical edits, resolve which component/file the user is targeting
          if (promptAnalysis.targets.length || isSurgicalEdit || selectedSourceFile || requestedPageTarget) {
            const analysedTarget = selectedSourceFile ? null : resolveEditTarget(rawInput, analysis, {
              preferredFile: visiblePageFile,
              files: vfsFiles,
              restrictToPreferredFile: Boolean(visiblePageFile),
            });
            const target = selectedSourceFile
              ? { file: selectedSourceFile, component: selectedSourceFile.split('/').pop()?.replace(/\.\w+$/, '') ?? selectedSourceFile, section: selectedTarget?.section, confidence: 'high' as const }
              : analysedTarget;
            if (target) {
              resolvedTargetFile = target.file;
              liveStep('planning', `🎯 Edit target: ${target.component} in ${target.file}`, `Confidence: ${target.confidence}`);
              const targetFileContent = vfsFiles[target.file];
              const contentSnippet = targetFileContent
                ? targetFileContent.slice(0, 8000)
                : '';
              editTargetContext = [
                '',
                `🎯 EDIT TARGET RESOLVED (confidence: ${target.confidence}):`,
                `  File: ${target.file}`,
                `  Component: ${target.component}`,
                target.section ? `  Section: ${target.section}` : '',
                '',
                contentSnippet ? `Current source of ${target.file}:` : '',
                contentSnippet ? '```tsx' : '',
                contentSnippet,
                contentSnippet ? '```' : '',
              ].filter(Boolean).join('\n');
            } else if (requestedPageTarget) {
              resolvedTargetFile = requestedPageTarget.filePath;
            }
          }
          // New-page requests ("add a case study page") are site-level but
          // own no existing source part: they author a new file plus nav.
          const createsPage = /\b(add|create|make|build|new|generate)\b[^.]{0,80}?\bpages?\b/i.test(rawInput);
          const siteScope = !createsPage && !requestedPageTarget && !selectedSourceFile && (capabilityInterpretation.envelope.scope.level === 'site' || /\b(across (?:the |all )?(?:site|pages)|site[ -]wide|whole site|every page|all pages)\b/i.test(rawInput));
          resolvedSourceTargets = resolveEditSourceTargets(rawInput, analysis, {
            files: vfsFiles,
            pageFiles: pageTargets.map(page => page.filePath),
            preferredFile: visiblePageFile ?? resolveCanonicalAuthoringPage(vfsFiles).filePath,
            siteScope,
            pinnedFile: selectedSourceFile,
          });
          if (siteScope && resolvedSourceTargets.length === 0) throw new Error('Could not identify the requested site part in the page sources. Select it in Preview or name its component.');
          resolvedTargetFile = resolvedSourceTargets[0] ?? resolvedTargetFile;
        }
      } else if (currentCode) {
        // Fallback: detect React from currentCode if no vfsFiles available
        isReactProject = currentCode.includes('import ') && (
          currentCode.includes('from \'react\'') ||
          currentCode.includes('from "react"') ||
          currentCode.includes('export default function') ||
          currentCode.includes('export default const')
        );
      }

      // ── Phase 1c: Build component behavior map for ALL edit types ──
      // Previously only built for behavioral edits — now provides context-awareness for all edits
      let behaviorContext = '';
      const isAnyEditMode = isSurgicalEdit || isBehavioralEdit || !!currentCode;
      if (isAnyEditMode && vfsFiles && Object.keys(vfsFiles).length > 0) {
        try {
          const behaviorMap = buildComponentBehaviorMap(
            previewRef?.current ? { getIframe: previewRef.current.getIframe } as any : { getIframe: () => null } as any,
            vfsFiles,
          );
          behaviorContext = formatBehaviorMapForPrompt(behaviorMap);
          if (behaviorContext) {
            liveStep('analyzing', `🧠 Behavior map: ${behaviorMap.elements.length} interactive elements, ${Object.keys(behaviorMap.stateByFile).length} stateful files`);
          }
        } catch { /* behavior map is best-effort */ }
      }

      // Build theme/styling context from Systems AI blueprint so in-builder edits stay consistent
      const themeContextBlock = (() => {
        if (!systemsBuildContext) return '';
        const { brand, design, identity } = systemsBuildContext;
        const lines: string[] = ['[🎨 Theme & Styling — Match this design language for all new elements]'];
        if (brand?.business_name) lines.push(`Business: ${brand.business_name}`);
        if (brand?.tone) lines.push(`Tone: ${brand.tone}`);
        if (brand?.palette) {
          const p = brand.palette;
          const colors = [
            p.primary && `Primary: ${p.primary}`,
            p.secondary && `Secondary: ${p.secondary}`,
            p.accent && `Accent: ${p.accent}`,
            p.background && `BG: ${p.background}`,
            p.foreground && `FG: ${p.foreground}`,
          ].filter(Boolean).join(' | ');
          if (colors) lines.push(`Palette: ${colors}`);
        }
        if (brand?.typography) {
          const t = brand.typography;
          if (t.heading || t.body) lines.push(`Typography: ${t.heading || 'auto'} (headings) / ${t.body || 'auto'} (body)`);
        }
        if (design?.layout?.hero_style) lines.push(`Hero: ${design.layout.hero_style}`);
        if (design?.buttons?.style) lines.push(`Buttons: ${design.buttons.style}`);
        if (design?.effects?.glassmorphism) lines.push(`Effects: glassmorphism`);
        if (design?.effects?.shadows) lines.push(`Shadows: ${design.effects.shadows}`);
        if (design?.content?.writing_style) lines.push(`Writing Style: ${design.content.writing_style}`);
        if (identity?.industry) lines.push(`Industry: ${identity.industry.replace(/_/g, ' ')}`);
        return lines.length > 1 ? lines.join('\n') : '';
      })();

      // Build rich context block for full-generation requests
      const contextLines: string[] = [];
      if (systemType) contextLines.push(`Business type: ${systemType}`);
      if (templateName) contextLines.push(`Template: ${templateName}`);
      if (userDesignProfile) {
        contextLines.push(`Design style: ${userDesignProfile.dominantStyle || 'mixed'}`);
        if (userDesignProfile.industryHints?.length) contextLines.push(`Industry: ${userDesignProfile.industryHints.join(', ')}`);
      }
      if (businessDataContext) contextLines.push(`\nBusiness data:\n${businessDataContext.slice(0, 800)}`);
      if (pageStructureContext) contextLines.push(`\nPage structure:\n${pageStructureContext.slice(0, 600)}`);
      if (backendStateContext) contextLines.push(`\nBackend state:\n${backendStateContext.slice(0, 400)}`);
      if (vfsContext) contextLines.push(`\nCurrent VFS project files:\n${vfsContext.slice(0, 2400)}`);
      if (siteAnalysisContext && !isSurgicalEdit) contextLines.push(`\nSite component structure:\n${siteAnalysisContext.slice(0, 1500)}`);
      if (themeContextBlock) contextLines.push(`\n${themeContextBlock}`);
      if (uiFoundation) {
        const facades = uiFoundation.runtimeFacades;
        contextLines.push([
          '\n[Snapshot-owned UI foundation — hard contract]',
          `Snapshot UI imports: ${uiFoundation.primitiveImports.join(', ')}`,
          facades
            ? `VFS UI runtime: Lucide ${facades.icons}; Framer Motion ${facades.animation}; Zod ${facades.schemas}; React Hook Form + zodResolver ${facades.forms}; styles ${facades.styles}; Radix namespace ${facades.radix}; Radix primitive modules ${facades.radixPrimitives.map((primitive) => `@/unison/ui/radix/${primitive}`).join(', ')}.`
            : 'Prefer VFS imports: @/unison/ui/icons for Lucide, @/unison/ui/zod and @/unison/ui/forms for schemas/forms, @/unison/ui/radix/<primitive> for Radix, @/unison/ui/animation for Framer Motion, and @/unison/ui/styles for typography, colors, component styles, and Tailwind class composition.',
          isThemeEdit
            ? 'Theme colors and fonts are applied by the theme lane, not in source. Use semantic token classes in affected components; never write /src/index.css or /src/unison/ui/*.'
            : 'Use semantic Stage 4b Tailwind tokens. Never write /src/index.css or /src/unison/ui/*.',
          'Preserve accessible labels and data-ut-intent attributes.',
        ].join('\n'));
      }
      if (isImageEdit) {
        contextLines.push([
          '\n[Image edit contract]',
          'Apply the image directly in the requested section component and return the complete modified file in the files JSON contract.',
          'Use a stable HTTPS image URL (prefer a verified images.unsplash.com URL) in src or backgroundImage. Do not create local .png/.jpg asset files, placeholders, or describe the change without modifying code.',
          'Include descriptive alt text and preserve the section layout unless the user requested a layout change.',
        ].join('\n'));
      }
      if (designIntervention) {
        contextLines.push([
          '\n[Snapshot-owned deterministic design intervention — hard contract]',
          `Layout: ${designIntervention.layoutRecipe}`,
          `Section variants: ${designIntervention.sectionVariants.join(', ')}`,
          `Motion recipes: ${designIntervention.motionRecipes.join(', ')} (${designIntervention.motionBudget} budget)`,
          `Interaction recipes: ${designIntervention.interactionRecipes.join(', ')}`,
          `${designIntervention.aiDirective} Do not write /.unison/design-intervention.json.`,
        ].join('\n'));
      }

      // ── M6/M7: Catalog Context Injection (Lane B) ──
      // Give the AI structured awareness of the canonical catalog registry,
      // live row counts, active bindings, and the currently selected section
      // so it prefers catalog operations over hand-editing TSX for content.
      let connectorCatalogSummary: string | null = null;
      try {
        const industryForCatalog =
          systemsBuildContext?.identity?.industry ??
          (userDesignProfile?.industryHints?.[0] ?? null);
        const catalogCtx = await buildCatalogContext({
          businessId: businessId ?? null,
          projectId: projectId ?? null,
          industry: industryForCatalog,
          selectedSection: selectedTarget?.scopeAncestors?.sectionId ? { sectionId: selectedTarget.scopeAncestors.sectionId, componentType: selectedTarget.scopeAncestors.componentType ?? undefined, pagePath: selectedTarget.scopeAncestors.pagePath ?? undefined } : null,
        });
        const rendered = renderCatalogContextForPrompt(catalogCtx);
        connectorCatalogSummary = rendered || null;
        if (rendered) contextLines.push(`\n${rendered}`);
      } catch (err) {
        console.warn('[AIBuilderPanel] buildCatalogContext failed; continuing without it', err);
      }

      const richContext = contextLines.length ? `\n\n[Context]\n${contextLines.join('\n')}` : '';

      // For surgical edits, inject a strict prompt guard so the AI makes ONLY the targeted change
      // AND mandate that it outputs actual code, not just reasoning
      // Use intelligent prompt for general requests; for surgical edits, still inject strict guard
      const promptForAI = isLaunchPlanningRequest
        ? [
            'Generate a complete launch planning output for the brief below.',
            'Include prioritized tasks, readiness score, risk register, owner checklists, launch copy, and follow-up questions.',
            '',
            `Brief:\n${_userContent}`,
          ].join('\n')
        : isSurgicalEdit
        ? [
            '🚨 SURGICAL EDIT MODE — CHANGE ONLY THE TARGETED ELEMENT/COMPONENT 🚨',
            '',
            // Include structured analysis so the AI understands multi-sentence requests
            promptAnalysis.structuredDirective,
            '',
            `User Request: ${_userContent}${_fileContext}`,
            editTargetContext,
            siteAnalysisContext ? `\nSite component map:\n${siteAnalysisContext.slice(0, 1500)}` : '',
            '',
            '⚠️ MANDATORY: You MUST output the modified code, not just explain the change.',
            'For multi-file React projects: output JSON {"files": {"/path/file.tsx": "...content..."}, "deletions": ["/path/obsolete.tsx"], "explanation": "..."}. Omit empty fields.',
            'For single-file: output the full modified file in a ```tsx code fence.',
            '',
            '⚠️ CRITICAL SURGICAL EDIT RULES:',
            '1. Output ONLY the file(s) that need to change — do NOT regenerate the entire project',
            '2. If the edit targets a specific component, output ONLY that component file with the change applied',
            '3. For multi-file projects, use JSON format: {"files": {"/path/file.tsx": "...content..."}, "deletions": ["/path/obsolete.tsx"]}',
            '4. Every section, style, and data attribute NOT mentioned MUST stay IDENTICAL',
            '5. DO NOT re-generate, rephrase, or "improve" unmentioned sections or components',
            '6. DO NOT change colors, fonts, layout, or content outside the targeted element',
            '7. If the change is purely CSS/class-based, only modify the class list on that one element',
            '8. Think of this like a diff — your output should be identical to the input except for the one change',
            '9. For React projects: preserve all imports, hooks, state, and component structure — only change the targeted JSX/logic',
            '10. When adding new elements or modifying styles, match the existing theme — use the same colors, fonts, spacing, and design patterns',
            // Inject constraints from prompt analysis
            ...promptAnalysis.constraints.map(c => {
              const prefix = c.type === 'preserve' ? '🔒 PRESERVE' : c.type === 'avoid' ? '🚫 AVOID' : c.type === 'require' ? '✅ REQUIRE' : '🎨 MATCH';
              return `${prefix}: ${c.description}`;
            }),
            themeContextBlock ? `\n${themeContextBlock}` : '',
          ].filter(Boolean).join('\n')
        : (() => {
            // Budget the prompt to stay within the 50k message content limit
            const MAX_PROMPT_CHARS = 40_000;
            let prompt = `${intelligentPrompt}${_fileContext}\n\n[Execution contract]\nReturn concrete VFS source changes, never instructions or prose in place of code. Use a JSON file map for multi-file work. You may create or replace components, pages, hooks, state, elements, sections, typography, and behavior. To remove a file, include its canonical path in "deletions". Preserve HashRouter ownership: edit route page files and links, not the generated router shell.`;
            if (prompt.length + richContext.length <= MAX_PROMPT_CHARS) {
              prompt += richContext;
            } else {
              // Progressively trim context to fit
              const remaining = MAX_PROMPT_CHARS - prompt.length;
              if (remaining > 200) {
                prompt += richContext.slice(0, remaining);
              }
            }
            return prompt;
          })();

      // Derive templateAction from prompt analysis instead of regex
      const templateAction = (() => {
        if (isLaunchPlanningRequest) return undefined;
        switch (promptAnalysis.intent) {
          case 'full_generation': return 'full-control';
          case 'add_section': return 'add';
          case 'remove_section': return 'remove';
          case 'restyle': return 'restyle';
          case 'content_update':
          case 'surgical_edit':
          case 'fix_error':
          case 'wire_backend':
          case 'refactor':
            return 'modify';
          default:
            return currentCode ? 'modify' : undefined;
        }
      })();

      // ── Phase 3: AI Gateway Call ──
      advancePlanStep(taskPlan, 'analyze', 'done');
      advancePlanStep(taskPlan, 'locate', 'done');
      advancePlanStep(taskPlan, 'generate', 'running');
      liveStep('generating', 'Calling AI model...', gatewayConfig?.selectedModelId || 'auto-select');

      // Call AI service with retry logic — keep retries minimal to avoid long thinking loops
      const MAX_RETRIES = 1;
      let response = null;
      let lastError = null;
      let canonicalRouteOps: TopologyChange[] = [];
      let canonicalCandidate: AICandidateChangeSet | undefined;
      let dedicatedPageGeneration = false;
      
      // Global timeout for the whole turn. A source edit runs the Composer
      // write → check → repair loop (up to 3 provider calls), so 150s cut
      // healthy edits off mid-repair with a reason-less abort. Give the loop
      // its full budget and always abort with a readable reason.
      const globalAbort = new AbortController();
      const BUILDER_TURN_TIMEOUT_MS = 420_000;
      globalTimeout = setTimeout(
        () => globalAbort.abort(new DOMException('The AI edit took longer than 7 minutes and was stopped. Try a smaller, more specific change.', 'TimeoutError')),
        BUILDER_TURN_TIMEOUT_MS,
      );
      
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (globalAbort.signal.aborted) {
          throw new Error('Request timed out. Please try a simpler prompt.');
        }
        try {
          if (attempt > 0) {
            // Update thinking to show retry
            thinkingSteps.push({
              id: generateId(),
              type: 'analyzing',
              message: `Retrying (attempt ${attempt + 1}/${MAX_RETRIES + 1})...`,
              timestamp: new Date(),
            });
            setMessages(prev => prev.map(m =>
              m.id === streamingId ? { ...m, thinking: [...thinkingSteps] } : m
            ));
            // Exponential backoff: 1s, 2s
            await new Promise(r => setTimeout(r, attempt * 1000));
          }
          
          // Truncate currentCode to stay within edge function limits
          const MAX_CODE_LENGTH = 120_000;
          const truncatedCode = currentCode && currentCode.length > MAX_CODE_LENGTH
            ? currentCode.substring(0, MAX_CODE_LENGTH) + '\n<!-- ... truncated for AI processing -->'
            : currentCode;

          // Canonical design context — derived from the registered section variant
          // registry and the canonical intent registry (M2). The legacy site
          // elements library is retired as an AI authority.
          // SKIP for surgical edits — broad design context pressures the AI toward
          // full-page generation and conflicts with targeted edit instructions.
          const siteElementsLibraryContext = isSurgicalEdit
            ? undefined
            : generateCanonicalDesignPrompt({
                systemType,
                userPrompt: _userContent,
                maxSections: 12,
              });

          // Build compact VFS files payload for ALL edit modes (not just surgical)
          // The edge function's contextCompactor handles budget/prioritization
          let vfsPayload: Record<string, string> | undefined;
          if (isReactProject && vfsFiles) {
            const MAX_VFS_PAYLOAD = 120_000;
            let totalSize = 0;
            vfsPayload = {};
            // Prioritize resolved target file, then .tsx/.jsx, then .css
            const sortedPaths = Object.keys(vfsFiles).sort((a, b) => {
              if (resolvedTargetFile) {
                if (a === resolvedTargetFile) return -1;
                if (b === resolvedTargetFile) return 1;
              }
              const aReact = /\.(tsx|jsx)$/.test(a) ? 0 : /\.css$/.test(a) ? 1 : 2;
              const bReact = /\.(tsx|jsx)$/.test(b) ? 0 : /\.css$/.test(b) ? 1 : 2;
              return aReact - bReact;
            });
            for (const p of sortedPaths) {
              const content = vfsFiles[p];
              if (totalSize + content.length > MAX_VFS_PAYLOAD) continue;
              vfsPayload[p] = content;
              totalSize += content.length;
            }
          }
          const scopedCurrentCode = isSurgicalEdit && resolvedTargetFile && vfsFiles?.[resolvedTargetFile]
            ? vfsFiles[resolvedTargetFile]
            : truncatedCode;

          // Rendered site context: live DOM of the current route, cached
          // digests of routes viewed this session, source digests otherwise.
          let previewSnapshot: string | undefined;
          let generatedSourceInventory = '';
          try {
            const iframe = previewRef?.current?.getIframe?.();
            let doc: Document | null = null;
            let route = '/';
            try {
              doc = iframe?.contentDocument ?? null;
              route = (iframe?.contentWindow?.location.hash || '#/').replace(/^#/, '') || '/';
            } catch { /* cross-origin preview */ }
            previewSnapshot = buildRenderedSiteDigest({
              doc,
              route,
              vfsFiles: vfsFiles ?? {},
              signature: computeBuilderVfsSignature(vfsFiles ?? {}),
            });
          } catch { /* best-effort */ }
          try {
            const graph = buildSystemGraph({
              files: vfsFiles ?? {},
              revisionId,
              diagnostics: iframeErrors.map((error, index) => ({
                id: `diagnostic:preview:${index}`,
                level: error.type === 'runtime' || error.type === 'syntax' ? 'error' : 'warning',
                message: error.message,
                path: error.file,
              })),
            });
            const graphText = renderSystemGraphForPrompt(graph);
            if (graphText) previewSnapshot = `${previewSnapshot ?? ''}\n\n${graphText}`.trim();
            if (selectedTarget) {
              const inspectionContext = createUnisonBuilderContext({ files: vfsFiles, revisionId, projectId, businessId });
              const selectedEntity = await dispatchBuilderOperation(inspectionContext, {
                files: vfsFiles, revisionId, projectId, businessId,
              }, 'inspect_editable_entity', {
                selector: selectedTarget.selector,
                revisionId: selectedTarget.revisionId,
                pagePath: selectedTarget.scopeAncestors?.pagePath,
                pageId: selectedTarget.scopeAncestors?.pageId,
                sectionId: selectedTarget.scopeAncestors?.sectionId,
                sectionType: selectedTarget.scopeAncestors?.sectionType,
                componentType: selectedTarget.scopeAncestors?.componentType,
                componentInstanceId: selectedTarget.scopeAncestors?.componentInstanceId,
                artifactId: selectedTarget.scopeAncestors?.artifactId,
                elementId: selectedTarget.scopeAncestors?.elementId,
                clickedTag: selectedTarget.tagName,
                sourceTable: selectedTarget.provenance?.sourceTable,
                rowId: selectedTarget.provenance?.rowId,
                field: selectedTarget.provenance?.field,
                bindingId: selectedTarget.provenance?.bindingId,
                targetPath: selectedTarget.provenance?.targetPath,
                primaryIntent: selectedTarget.intent,
              });
              previewSnapshot = `${previewSnapshot ?? ''}\n\nEDITABLE ENTITY: ${JSON.stringify(selectedEntity)}`.trim();
              emitAgentEvent({ kind: 'discovery', message: `Resolved selected target as ${selectedEntity.kind} via ${selectedEntity.allowedMutationLanes.join(', ')}`, status: 'ok', revisionId });
            }
            emitAgentEvent({ kind: 'discovery', message: 'Read the current revision graph, page structure, and preview diagnostics', status: 'ok' });
          } catch { /* best-effort */ }
          try {
            const generatedArtifacts = discoverGeneratedSiteArtifacts(vfsFiles ?? {});
            generatedSourceInventory = renderGeneratedSiteDiscoveryForPrompt(generatedArtifacts);
            previewSnapshot = `${previewSnapshot ?? ''}\n\n${generatedSourceInventory}`.trim();
            const artifactSummary = [
              generatedArtifacts.authoredCatalogItems.length && `${generatedArtifacts.authoredCatalogItems.length} authored product${generatedArtifacts.authoredCatalogItems.length === 1 ? '' : 's'}`,
              generatedArtifacts.controls.length && `${generatedArtifacts.controls.length} commerce control${generatedArtifacts.controls.length === 1 ? '' : 's'}`,
              generatedArtifacts.cartRuntimeFiles.length && `${generatedArtifacts.cartRuntimeFiles.length} cart runtime file${generatedArtifacts.cartRuntimeFiles.length === 1 ? '' : 's'}`,
            ].filter(Boolean).join(', ');
            emitAgentEvent({
              kind: 'discovery',
              message: artifactSummary ? `Read ${artifactSummary} from generated source` : 'Read generated source inventory',
              status: 'ok',
            });
          } catch { /* best-effort */ }
          // Speed: only fetch saved catalog records when the request or the clicked item needs them.
          const needsCatalog = /\b(product|service|menu|price|pricing|catalog|item|cart|shop|store|sku|stock|inventory)s?\b/i.test(_userContent)
            || Boolean(selectedTarget?.provenance?.sourceTable);
          if (businessId && needsCatalog) {
            try {
              const agentCtx = { features: featuresRef.current, files: vfsFiles ?? {}, businessId, projectId, revisionId };
              const connector = createUnisonBuilderContext({ ...agentCtx });
              const catalog = await dispatchBuilderOperation(connector, agentCtx, 'inspect_catalog');
              previewSnapshot = `${previewSnapshot ?? ''}\n\n${renderCatalogForPrompt(catalog)}`.trim();
              emitAgentEvent({ kind: 'discovery', message: `Read ${catalog.length} catalog items`, status: 'ok' });
            } catch { /* best-effort */ }
          }

          // ── Build conversation history for multi-turn awareness ──
          // Preserve prior requests and decisions; source bytes use their own bounded projection.
          const conversationHistory: Array<{ role: string; content: string }> = [];
          const priorMessages = messages.filter(m => 
            (m.role === 'user' || m.role === 'assistant') && 
            m.content && 
            m.content.trim().length > 0 &&
            !m.isStreaming
          );
          // Take last N messages (excluding the current user message which is already in promptForAI)
          const historySlice = priorMessages;
          for (const m of historySlice) {
            // For assistant messages, strip thinking/reasoning artifacts and keep only the explanation
            const content = m.content;
            if (content.trim()) {
              conversationHistory.push({ role: m.role, content });
            }
          }
          // Append the current user prompt as the final message
          conversationHistory.push({ role: 'user', content: promptForAI });

          // V4 M8: the in-Builder lane receives the SAME bounded canonical
          // registry projection the Wizard composer and Lane B already get.
          ensureCurrentRequest();
          const canonicalPageContext = vfsFiles
            ? resolveCanonicalAuthoringPage(vfsFiles, resolvedTargetFile || visiblePageFile, visiblePageFile)
            : null;
          const builderRegistryContext = resolveBuilderRegistryContext({
            vfsFiles: vfsFiles ?? undefined,
            industry: systemType ?? null,
            templateId: templateName ?? null,
            themePresetId: (wizardSeed as { themePresetId?: string } | null)?.themePresetId ?? null,
            businessId: businessId ?? null,
            projectId: projectId ?? null,
            pageRole: canonicalPageContext?.role ?? null,
          });

          const isCartWiringRequest = /\b(?:cart|bag|checkout)\b/i.test(_userContent);
          const authoringLane = builderAuthoringLane(isLaunchPlanningRequest, isCatalogMutationRequest(_userContent), vfsFiles);
          const useCanonicalComposer = authoringLane === 'composer';
          if (useCanonicalComposer) {
            if (!canonicalPageContext) throw new Error('Select an existing page before editing.');
            const page = canonicalPageContext;
            const editorDiagnostics = diagnosticsAggregator.getDiagnosticsForFiles(
              Object.keys(vfsFiles ?? {}),
              ['typescript'],
            ).slice(0, 12);
            const editorDiagnosticsContext = editorDiagnostics.length > 0
              ? `Current VFS TypeScript diagnostics (baseline evidence; some may predate this request. Fix relevant errors without rewriting unrelated files):\n${editorDiagnostics
                .map((diagnostic) => `- ${diagnostic.file}:${diagnostic.line ?? '?'}:${diagnostic.column ?? '?'} TS${diagnostic.code ?? ''}: ${diagnostic.message.slice(0, 400)}`)
                .join('\n')}`
              : '';
            const selectionContext = layoutOps?.selectionSelector
              ? JSON.stringify({
                  selector: layoutOps.selectionSelector,
                  section: layoutOps.selectionSection ?? null,
                  sourceFile: page.filePath,
                  route: page.route,
                })
              : '';
            emitAgentEvent({ kind: 'plan', message: `Writing changes to ${page.filePath.split('/').pop()}`, status: 'running', path: page.filePath });
            const editResult = await unisonAppBuilder.edit({
              operationId: `builder:${generateId()}`,
              guestDemoOperationId,
              attachmentContext: _fileContext,
              images: _attachments.length > 0
                ? _attachments.map((a) => ({ name: a.name, data: a.data }))
                : undefined,
              page,
              brief: [
                'Edit the accepted React project without changing unrelated source.',
                promptAnalysis.structuredDirective
                  ? `Structured analysis of the request (clarifying guidance; the original instruction is authoritative):\n${promptAnalysis.structuredDirective}`
                  : '',
                themeContextBlock,
                pageStructureContext ? `Page structure: ${pageStructureContext}` : '',
                siteAnalysisContext ? `Component structure: ${siteAnalysisContext}` : '',
              ].filter(Boolean).join('\n').slice(0, 6500),
              knowledgeQuery: `${_userContent} ${page.role} ${systemType ?? ''}`,
              instruction: _userContent.slice(0, 4000),
              currentFiles: vfsFiles,
              baseRevisionId: revisionId,
              connectorContext: {
                projectId, businessId, revisionId,
                catalogSummary: connectorCatalogSummary,
                registryContext: builderRegistryContext,
                requestEnvelope: capabilityInterpretation.envelope,
                descriptor: selectedTarget?.descriptor,
                selection: selectedTarget ? {
                  selector: selectedTarget.selector,
                  clickedTag: selectedTarget.tagName,
                  projectId,
                  revisionId: selectedTarget.revisionId,
                  pagePath: selectedTarget.scopeAncestors?.pagePath,
                  sectionId: selectedTarget.scopeAncestors?.sectionId,
                  componentPath: page.filePath,
                  sourceTable: selectedTarget.provenance?.sourceTable,
                  rowId: selectedTarget.provenance?.rowId,
                  field: selectedTarget.provenance?.field,
                  resourceMark: selectedTarget.provenance?.resource,
                  bindingId: selectedTarget.provenance?.bindingId,
                  primaryIntent: selectedTarget.intent,
                } : null,
              },
              sourceTargets: Array.from(new Set([
                ...(resolvedSourceTargets.length ? resolvedSourceTargets : [page.filePath]),
                // Edit policy: shared parts the page renders (nav, footer,
                // project components) are editable with the page.
                ...collectLocalImportClosure(vfsFiles, page.filePath, (path) =>
                  /^\/src\/(pages|project-components|components\/generated)\/.+\.(t|j)sx?$/.test(path)),
                ...(isCartWiringRequest
                  ? sourceTargetsForCartWiring(vfsFiles, page.filePath)
                  : []),
              ])),
              routes: [],
              registryContext: builderRegistryContext ?? undefined,
              runtimeContext: [
                targetContext,
                editTargetContext,
                `Conversation history (prior instructions, not proof of completed saves):\n${JSON.stringify(priorMessages.map(m => ({ role: m.role, content: m.content })))}`,
                isCartWiringRequest ? generatedSourceInventory : '',
                capabilityPlan.proposal.intentBindings.length && needsRenderableUiPatch
                  ? `Requested UI bindings: ${JSON.stringify(capabilityPlan.proposal.intentBindings)}. Find or create real matching controls in the authored source, adding these exact data-ut-slot and data-ut-intent attributes. Do not label unrelated controls to satisfy a target. Backend activation remains a separate capability approval.`
                  : '',
                isCartWiringRequest
                  ? 'Reuse the existing shared cart runtime so add-to-cart, bag counts and checkout read the same live items; never use a second hard-coded cart. Preserve existing navigation actions and destinations, including the interactive bag link.'
                  : '',
                selectionContext ? `Selected rendered element: ${selectionContext}` : '',
                editorDiagnosticsContext,
                previewSnapshot,
                businessDataContext ? `Business data: ${businessDataContext}` : '',
                backendStateContext,
                behaviorContext,
                unisonContext,
              ]
                .filter(Boolean).map((value) => typeof value === 'string' ? value : JSON.stringify(value)).join('\n').slice(0, 12000),
              gatewayOptions: gatewayConfig ? {
                selectedModelId: gatewayConfig.selectedModelId,
                reasoningEffort: gatewayConfig.reasoningEffort,
                timeoutMs: gatewayConfig.timeoutMs,
                autoModelSelection: gatewayConfig.autoModelSelection,
                maxTokens: gatewayConfig.maxTokens,
              } : undefined,
              signal: globalAbort.signal,
              timeoutMs: BUILDER_TURN_TIMEOUT_MS,
            });
            if (editResult.candidate.status !== 'ready-for-commit' || !editResult.changeSet) {
              const diagnostic = editResult.candidate.diagnostics[0] ?? `Affinity stopped: ${editResult.stopReason}`;
              emitAgentEvent({ kind: 'plan', message: `Could not finish writing the change: ${diagnostic}`, status: 'failed' });
              throw new Error(diagnostic);
            }
            const candidate = editResult.changeSet;
            emitAgentEvent({ kind: 'plan', message: `Wrote changes to ${candidate.fileOps.length} file${candidate.fileOps.length === 1 ? '' : 's'}`, status: 'ok' });
            for (const op of candidate.fileOps) {
              const d = lineDelta(vfsFiles?.[op.path], op.type === 'delete' ? '' : op.content);
              emitAgentEvent({ kind: 'file_change', message: `${op.type === 'delete' ? 'Removing' : 'Editing'} ${op.path}`, path: op.path, status: 'running', ...d });
            }
            canonicalCandidate = candidate;
            canonicalRouteOps = candidate.routeOps;
            const pageOps = candidate.routeOps.filter((operation) => operation.type === 'add_page');
            if (pageOps.length > 0) {
              const pageTargetsForGeneration = pageOps.map((operation) => {
                const { pageId, title, route } = operation;
                if (!pageId || !title || !route) throw new Error('Affinity returned an incomplete new-page target.');
                const page = createBuilderPage(pageId, title, route, operation.pageType ?? 'custom', {
                  showInNav: operation.showInNav ?? true,
                  navOrder: operation.navOrder,
                  createdBy: 'ai',
                });
                page.filePath = deriveFilePath(page);
                return {
                  pageId: page.pageId,
                  title: page.title,
                  route: page.path,
                  filePath: page.filePath,
                  role: page.pageRole ?? page.pageType,
                  pageType: page.pageType,
                  showInNav: page.showInNav,
                  navOrder: page.navOrder,
                };
              });
              ensureCurrentRequest();
              const generation = await unisonAppBuilder.generatePages({
                operationId: `builder-pages:${generateId()}`,
                connectorContext: { projectId, businessId, revisionId, catalogSummary: connectorCatalogSummary, registryContext: builderRegistryContext, requestEnvelope: capabilityInterpretation.envelope },
                baseRevisionId: revisionId ?? null,
                // Retain the scoped navigation edits from planning, but author
                // new pages only once against the existing accepted site.
                currentFiles: Object.fromEntries(Object.entries(editResult.candidateFiles)
                  .filter(([path]) => path in vfsFiles)),
                pages: pageTargetsForGeneration,
                existingRoutes: pageTargets.map(({ title, route }) => ({ title, route })),
                businessName: templateName?.trim() || 'Website',
                industry: userDesignProfile?.industryHints?.[0] ?? systemType ?? 'generic',
                visionBrief: _userContent.slice(0, 1200),
                registryContext: builderRegistryContext ?? undefined,
                runtimeContext: [
                  themeContextBlock,
                  pageStructureContext,
                  businessDataContext,
                  backendStateContext,
                  behaviorContext,
                  unisonContext,
                ].filter(Boolean).join('\n').slice(0, 12000),
                signal: globalAbort.signal,
                budgetMs: 240_000,
                concurrency: 3,
                onProgress: ({ page, index, total, phase }) => {
                  liveStep(
                    phase === 'authoring' ? 'generating' : 'validating',
                    phase === 'authoring'
                      ? `Authoring page ${index + 1}/${total}: ${page.title}`
                      : `${page.title}: ${phase}`,
                    page.route,
                  );
                },
              });
              if (generation.status !== 'ready-for-commit' || !generation.changeSet) {
                throw new Error(generation.diagnostics[0] ?? 'Affinity could not author every requested page.');
              }
              canonicalCandidate = buildAICandidateChangeSet({
                aiFiles: generation.candidateFiles,
                baseFiles: vfsFiles,
                baseRevisionId: revisionId ?? undefined,
                origin: 'builder',
                intent: 'in-builder-multi-page-generation',
                targetPages: pageTargetsForGeneration.map(page => page.filePath),
                routeOps: generation.routeOps,
                resolveDependencies: false,
              }).changeSet;
              canonicalRouteOps = [...generation.routeOps];
              dedicatedPageGeneration = true;
              response = {
                data: {
                  content: `Affinity prepared ${generation.outcomes.length} new page${generation.outcomes.length === 1 ? '' : 's'}.`,
                  actionType: 'canonical-page-generation',
                  filesDetected: canonicalCandidate.fileOps.map(operation => operation.path),
                },
                error: null,
              };
            } else {
              response = {
                data: {
                  content: editResult.summary ?? 'Affinity prepared this source candidate.',
                  actionType: 'canonical-source-edit',
                  filesDetected: candidate.fileOps.map(operation => operation.path),
                  guestDemoOperationId: editResult.guestDemoOperationId,
                },
                error: null,
              };
            }
          } else {
            ensureCurrentRequest();
            response = await runBuilderTurn<any>({
            messages: conversationHistory,
            connectorContext: {
              projectId, businessId, revisionId,
              catalogSummary: connectorCatalogSummary,
              registryContext: builderRegistryContext,
              requestEnvelope: capabilityInterpretation.envelope,
              descriptor: selectedTarget?.descriptor,
              selection: selectedTarget ? {
                selector: selectedTarget.selector,
                clickedTag: selectedTarget.tagName,
                projectId,
                revisionId: selectedTarget.revisionId,
                pagePath: selectedTarget.scopeAncestors?.pagePath,
                resourceMark: selectedTarget.provenance?.resource,
                sourceTable: selectedTarget.provenance?.sourceTable,
                rowId: selectedTarget.provenance?.rowId,
                field: selectedTarget.provenance?.field,
                primaryIntent: selectedTarget.intent,
              } : null,
            },
            registryContext: builderRegistryContext ?? undefined,
            // Milestone 4: durable envelope + verdict log, scoped to this draft.
            runContext: {
              draftId: projectId ?? null,
              projectId: projectId ?? null,
              businessId: businessId ?? null,
              prompt: _userContent.slice(0, 8000),
              operationId: guestDemoOperationId,
            },
            requestEnvelope: capabilityInterpretation.envelope,
            unisonContext,
            // Launch planning and catalog proposals retain chat transport; source is candidate-only.
            mode: isLaunchPlanningRequest ? 'launch-desk' : 'template-react',
            currentCode: undefined,
            editMode: false,
            debugMode: false,
            surgicalEdit: false,
            behavioralEdit: false,
            targetFile: resolvedTargetFile || undefined,
            componentBehaviorContext: behaviorContext || undefined,
            systemType,
            templateName,
            templateAction,
            launchBrief,
            userDesignProfile: userDesignProfile ?? undefined,
            systemsBuildContext: systemsBuildContext ?? undefined,
            // Durable WizardSeed → Lane B continuity: same seed/memory/intents/routes.
            wizardSeed: uiFoundation || designIntervention
              ? { ...(wizardSeed ?? {}), ...(uiFoundation ? { uiFoundation } : {}), ...(designIntervention ? { designIntervention } : {}) }
              : wizardSeed ?? undefined,
            siteElementsLibraryContext,
            attachments: _attachments.length > 0 ? _attachments : undefined,
            // Send VFS files for edit context (all edit types, not just surgical)
            vfsFiles: vfsPayload,
            // Preview DOM snapshot for live context awareness
            previewSnapshot,
            // Preview diagnostics for Lane B session memory
            previewDiagnostics: iframeErrors.length > 0
              ? iframeErrors.slice(0, 3).map(e => `${e.type}: ${e.message}${e.file ? ` (${e.file}:${e.line})` : ''}`).join('\n')
              : undefined,
            // Gateway options from user config
            gatewayOptions: gatewayConfig ? {
              selectedModelId: gatewayConfig.selectedModelId,
              reasoningEffort: gatewayConfig.reasoningEffort,
              timeoutMs: gatewayConfig.timeoutMs,
              autoModelSelection: gatewayConfig.autoModelSelection,
              maxTokens: gatewayConfig.maxTokens,
            } : undefined,
          });
          }
          
          // Check for retryable errors
          if (response.error) {
            // Extract the real error from the FunctionsHttpError context
            let bodyError = '';
            // First try response.data (sometimes populated even on error)
            if (response.data && typeof response.data === 'object' && 'error' in response.data) {
              bodyError = (response.data as { error?: string }).error || '';
            }
            // Then try reading the context (Response object) from FunctionsHttpError
            if (!bodyError && response.error) {
              try {
                const ctx = (response.error as any)?.context;
                if (ctx && typeof ctx?.json === 'function') {
                  const body = await ctx.json().catch(() => null);
                  if (body?.error) bodyError = body.error;
                  else if (body?.details) bodyError = `Validation: ${JSON.stringify(body.details)}`;
                } else if (ctx?.body && typeof ctx.body === 'string') {
                  const parsed = JSON.parse(ctx.body);
                  if (parsed?.error) bodyError = parsed.error;
                }
              } catch { /* swallow */ }
            }
            const errorMsg = bodyError || (response.error as Error).message || '';
            const statusCode = (response.error as any)?.status;
            console.warn(`[AIBuilderPanel] Edge function error (attempt ${attempt + 1}):`, errorMsg, 'status:', statusCode);
            
            const isRetryable = errorMsg.includes('non-2xx') || 
                               errorMsg.includes('timeout') ||
                               errorMsg.includes('temporarily unavailable') ||
                               errorMsg.includes('All AI providers failed') ||
                               statusCode === 503 ||
                               statusCode === 504;
            
            if (isRetryable && attempt < MAX_RETRIES) {
              lastError = new Error(bodyError || errorMsg || 'Edge function error');
              continue;
            }
            // Throw with the descriptive message
            throw new Error(bodyError || errorMsg || 'Edge function error');
          }
          
          // Success
          break;
        } catch (err) {
          lastError = err;
          if (attempt >= MAX_RETRIES) throw err;
        }
      }
      clearTimeout(globalTimeout);
      
      if (!response || response.error) {
        throw lastError || new Error('AI service failed after retries');
      }

      // ── Phase 4: Response Processing ──
      advancePlanStep(taskPlan, 'generate', 'done');
      advancePlanStep(taskPlan, 'patch', 'running');
      const modelUsed = response.data?.modelUsed || gatewayConfig?.selectedModelId || 'unknown';
      liveStep('validating', `Response received from ${modelUsed}`);

      // Extract AI reasoning (works for all models: thinking-tag extraction or native Anthropic blocks)
      const aiReasoning: string | undefined = response.data?.thinking || undefined;
      const isLaunchPlanningResponse = response.data?.mode === 'launch-desk' || !!response.data?.plan;
      // Milestone 4: id of the persisted envelope/verification run for this turn.
      const envelopeRunId = envelopeRunIdFromResponse(response.data);

      const responseMeta: Message['meta'] = {
        actionType: response.data?.actionType || (isLaunchPlanningResponse ? 'launch_planning' : undefined),
        modelUsed: response.data?.modelUsed,
        filesDetected: response.data?.filesDetected,
        warnings: response.data?.warnings,
        requiresApproval: response.data?.requiresApproval,
        removedFiles: response.data?.removedFiles,
        reviewSummary: response.data?.reviewSummary,
        guestDemoOperationId: response.data?.guestDemoOperationId,
        outOfScope: (response.data as { outOfScope?: { reason: string; suggestedPatch?: string } } | undefined)?.outOfScope,
      };

      // The edge function returns { content, generatedImage?, imagePlacement? }
      const aiContent = response.data?.content || 'I processed your request but have no specific output to show.';

      // ── M5/M7: Execute catalog tool calls returned by the model ──
      // The edge function may forward chat-completions `tool_calls` (or
      // catalogToolCalls) invoking canonical catalog operations. Execute
      // them against Supabase before we render the assistant message so
      // downstream hydration reflects the mutations immediately.
      try {
        const rawToolCalls: unknown =
          (response.data as any)?.tool_calls ??
          (response.data as any)?.catalogToolCalls ??
          null;
        if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0 && isCatalogMutationRequest(userContent)) {
          const normalized: RawToolCall[] = rawToolCalls
            .map((tc: any) => {
              const fn = tc?.function ?? tc;
              const name: string | undefined = fn?.name;
              if (!name) return null;
              return {
                id: tc?.id,
                name,
                arguments: fn?.arguments ?? tc?.arguments ?? tc?.input ?? {},
              } as RawToolCall;
            })
            .filter((v): v is RawToolCall => v !== null);
          if (normalized.length > 0) {
            const proposal = compileCatalogToolCalls(normalized);
            if (proposal.dataOps.length > 0) {
              canonicalCandidate = canonicalCandidate
                ? { ...canonicalCandidate, dataOps: [...(canonicalCandidate.dataOps ?? []), ...proposal.dataOps] }
                : buildAICandidateChangeSet({
                    aiFiles: {},
                    baseFiles: vfsFiles ?? {},
                    baseRevisionId: revisionId ?? undefined,
                    origin: 'builder',
                    intent: userContent,
                    dataOps: proposal.dataOps,
                  }).changeSet;
              toast.info(`${proposal.dataOps.length} catalog change${proposal.dataOps.length === 1 ? '' : 's'} ready for canonical commit`);
            }
            if (proposal.rejected.length > 0) {
              console.warn('[AIBuilderPanel] catalog proposals need a target:', proposal.rejected);
            }
          }
        } else if (Array.isArray(rawToolCalls) && rawToolCalls.length > 0) {
          console.warn('[AIBuilderPanel] Ignored catalog tool calls for a VFS source-edit request.');
        }
      } catch (err) {
        console.warn('[AIBuilderPanel] catalog tool execution failed', err);
      }

      if (isLaunchPlanningResponse) {
        liveStep('planning', 'Formatting launch plan for in-builder view...');
        const launchPlanContent = formatLaunchPlanForBuilder(response.data?.plan, aiContent);
        const completeStep: ThinkingStep = {
          id: generateId(),
          type: 'complete',
          message: 'Launch plan ready',
          timestamp: new Date(),
        };

        advancePlanStep(taskPlan, 'patch', 'done');
        advancePlanStep(taskPlan, 'refresh', 'done');

        setMessages(prev => prev.map(m =>
          m.id === streamingId
            ? {
                ...m,
                content: launchPlanContent,
                thinking: [...thinkingSteps, completeStep],
                taskPlan,
                isStreaming: false,
                modelUsed,
                claudeReasoning: aiReasoning,
                meta: responseMeta,
                responseTimestamp: new Date().toISOString(),
              }
            : m
        ));

        setActiveTab('code');
        return;
      }
      
      // Only validated candidates carry source. Chat/catalog text cannot write files.
      const explanationText = affinityReply(aiContent);
      let multiFileOutput: Record<string, string> | null = null;
      let multiFileDeletions: string[] = [];
      let transactionVerdict: string | null = null;
      if (canonicalCandidate?.fileOps.length) {
        const preparedOutput = canonicalCandidateOutput(canonicalCandidate);
        multiFileOutput = preparedOutput.files;
        multiFileDeletions = preparedOutput.deletions;
      }

      // Prepared Composer candidates bypass compatibility response extraction.
      if (multiFileOutput) {
        liveStep('validating', `Multi-file output: ${Object.keys(multiFileOutput).length} files detected`, Object.keys(multiFileOutput).join(', '));
        console.log('[AIBuilderPanel] Multi-file output detected:', Object.keys(multiFileOutput));
        
        const normalizedFiles = multiFileOutput;
        // Check if approval is recommended before auto-applying
        const shouldBlock = !isFullAuto && responseMeta?.requiresApproval &&
          responseMeta.warnings?.some(w => w.severity === 'error');

        // Client-side scope enforcement for scoped edits
        const isScopedTask = isSurgicalEdit || isBehavioralEdit || Boolean(selectionPinnedFile) || isNavigationPresentationPrompt(rawInput);
        const permissionCategory: AIEditPermissionCategory = isBehavioralEdit
          ? 'behavioral'
          : isSurgicalEdit
            ? 'surgical'
            : 'ui';
        const navigationStructureBlockReason = getUnrequestedNavigationSectionRemovalReason(
          vfsFiles ?? {}, normalizedFiles, rawInput,
        );
        const scopeBlockReason = navigationStructureBlockReason ?? (isScopedTask && !isFullAuto ? getScopedEditAutoApplyBlockReason({
          files: normalizedFiles,
          originalFiles: vfsFiles ?? {},
          prompt: rawInput,
          resolvedTargetFile,
          existingFileKeys: vfsFiles ? Object.keys(vfsFiles) : [],
          pinnedBySelection: Boolean(selectionPinnedFile),
          targetText: selectionPinnedFile ? (selectedTarget?.text ?? null) : null,
        }) : null);

        if (scopeBlockReason) {
          console.warn('[AIBuilderPanel] SCOPE BLOCK:', scopeBlockReason);
          setHeldFiles({ files: normalizedFiles, deletions: multiFileDeletions, routeOps: canonicalRouteOps, candidate: canonicalCandidate, guestDemoOperationId: responseMeta?.guestDemoOperationId, reason: `Edit held back: ${scopeBlockReason}` });
          toast.warning(`⚠️ Edit held for review: ${scopeBlockReason}`);
          transactionVerdict = transactionVerdictLine('held-for-review', scopeBlockReason);
        } else if (!canAutoApply(permissionCategory)) {
          const permissionReason = `${permissionCategory[0].toUpperCase()}${permissionCategory.slice(1)} edits are set to review before apply.`;
          setHeldFiles({ files: normalizedFiles, deletions: multiFileDeletions, routeOps: canonicalRouteOps, candidate: canonicalCandidate, guestDemoOperationId: responseMeta?.guestDemoOperationId, reason: permissionReason });
          toast.info('AI patch held for review', { description: permissionReason });
          transactionVerdict = transactionVerdictLine('held-for-review', permissionReason);
        } else if (shouldBlock) {
          void recordRunOutcome(envelopeRunId, 'rejected', { note: 'requires-approval' });
          console.warn('[AIBuilderPanel] Patch requires approval — NOT auto-applying');
          const heldReason = responseMeta?.warnings?.map((warning) => warning.message).filter(Boolean).join('; ')
            || 'The reviewer flagged this patch. Review the warnings, then apply.';
          setHeldFiles({ files: normalizedFiles, deletions: multiFileDeletions, routeOps: canonicalRouteOps, candidate: canonicalCandidate, guestDemoOperationId: responseMeta?.guestDemoOperationId, reason: heldReason });
          toast.warning('⚠️ AI patch flagged for review — apply it from the review card when ready');
          transactionVerdict = transactionVerdictLine('held-for-review', heldReason);
        } else {

          {
            console.log('[AIBuilderPanel] Applying candidate to VFS:', Object.keys(normalizedFiles));
            vfsEventBus.emit('ai:apply:start', { source: 'multi-file' });
            markPreviewPending();
            const sequentialTasks = [{ id: `${canonicalCandidate?.id ?? 'builder-pages'}:1`, files: normalizedFiles, deletions: multiFileDeletions, paths: [...Object.keys(normalizedFiles), ...multiFileDeletions] }];
            let applyOutcome: Awaited<ReturnType<AIBuilderApplyCallback>> = {
              success: false,
              errors: ['The AI candidate did not produce an executable task.'],
            };
            const appliedPaths: string[] = [];
            for (const [taskIndex, task] of sequentialTasks.entries()) {
              liveStep('validating', `Applying task ${taskIndex + 1}/${sequentialTasks.length}`, task.paths.join(', '));
              const taskOutcome = await applyAIBuilderFiles(onApplyToVFS, task.files, {
                prompt: userContent,
                model: modelUsed,
                summary: responseMeta?.reviewSummary,
                actionType: responseMeta?.actionType,
                origin: `multi-file-task-${taskIndex + 1}`,
                guestDemoOperationId: responseMeta.guestDemoOperationId,
                deletions: task.deletions,
                routeOps: taskIndex === sequentialTasks.length - 1 ? canonicalRouteOps : [],
                candidate: canonicalCandidate,
                requiresApproval: responseMeta?.requiresApproval,
                warnings: responseMeta?.warnings,
              });
              applyOutcome = taskOutcome;
              if (!taskOutcome.success) break;
              appliedPaths.push(...task.paths);
            }
            void recordRunOutcome(
              envelopeRunId,
              applyOutcome.success ? 'applied' : 'failed',
              {
                appliedPaths,
                error: applyOutcome.success ? undefined : applyOutcome.errors?.[0],
                note: `multi-file-sequential:${sequentialTasks.length}`,
              },
            );
            if (applyOutcome.success) {
              vfsEventBus.emit('ai:apply:complete', { filesWritten: appliedPaths, source: 'multi-file' });
              // P0.4: the commit is not the verdict — the preview is.
              const verification = await awaitPreviewVerification();
              if (verification.verified) {
                advancePlanStep(taskPlan, 'patch', 'done');
                advancePlanStep(taskPlan, 'bind_intent', 'done');
                advancePlanStep(taskPlan, 'create_route', 'done');
                advancePlanStep(taskPlan, 'install_workflow', 'done');
                advancePlanStep(taskPlan, 'enable_capability', 'done');
                advancePlanStep(taskPlan, 'update_registry', 'done');
                advancePlanStep(taskPlan, 'refresh_preview', 'done');
                advancePlanStep(taskPlan, 'validate', 'done');
                advancePlanStep(taskPlan, 'report', 'done');
                liveStep('complete', `✓ Applied ${sequentialTasks.length} sequential tasks to project`);
                const approvalNote = responseMeta?.requiresApproval ? ' (review recommended)' : '';
                toast.success(`✓ Multi-file project applied${approvalNote}`);
                transactionVerdict = transactionVerdictLine('verified');
              } else {
                advancePlanStep(taskPlan, 'patch', 'failed');
                advancePlanStep(taskPlan, 'refresh_preview', 'failed');
                liveStep('error', 'Saved, but the preview did not confirm the change', verification.reason);
                toast.warning('Saved, but the preview did not confirm the change', {
                  description: verification.reason,
                  duration: 8000,
                });
                transactionVerdict = savedUnconfirmedVerdictLine(verification.reason);
              }
            } else {
              const applyError = applyOutcome.errors?.[0] ?? 'The VFS rejected the generated files.';
              advancePlanStep(taskPlan, 'patch', 'failed');
              advancePlanStep(taskPlan, 'refresh_preview', 'failed');
              liveStep('error', 'AI edit was not applied', applyError);
              vfsEventBus.emit('ai:apply:error', { message: applyError, source: 'multi-file' });
              toast.error('AI edit was not applied', { description: applyError, duration: 8000 });
              if (responseMeta?.guestDemoOperationId) {
                void releaseGuestDemoReservation(responseMeta.guestDemoOperationId, 'canonical-commit-failed')
                  .catch((error) => console.warn('[AIBuilderPanel] Guest reservation release failed', error));
              }
              transactionVerdict = transactionVerdictLine('failed', applyError);
            }


        }
      }

      const edits: VFSEdit[] = Object.entries(multiFileOutput ?? {}).map(([path, content]) => ({ path, type: vfsFiles[path] === undefined ? 'create' : 'modify', linesChanged: content.split('\n').length, preview: content.substring(0, 200) }));
      multiFileDeletions.forEach(path => edits.push({ path, type: 'delete' }));
      // Preserve a failed apply/preview verdict instead of appending a success step.
      const executionFailed = thinkingSteps.some(step => step.type === 'error');
      if (!executionFailed) thinkingSteps.push({
        id: generateId(),
        type: aiReasoning ? 'reasoning' : 'complete',
        message: aiReasoning
          ? `Extended reasoning complete (${(aiReasoning.length / 1000).toFixed(1)}k chars)`
          : 'Generation complete',
        timestamp: new Date(),
        details: aiReasoning ? aiReasoning.slice(0, 500) + (aiReasoning.length > 500 ? '…' : '') : undefined,
      });
      if (aiReasoning && !executionFailed) {
        thinkingSteps.push({
          id: generateId(),
          type: 'complete',
          message: 'Response generated',
          timestamp: new Date(),
        });
      }

      if (executionFailed) {
        advancePlanStep(taskPlan, 'patch', 'failed');
        advancePlanStep(taskPlan, 'refresh_preview', 'failed');
      } else if (!multiFileOutput) {
        advancePlanStep(taskPlan, 'patch', 'failed');
        advancePlanStep(taskPlan, 'refresh_preview', 'failed');
      }

      // Update message — show ONLY the explanation text, NOT raw code
      setMessages(prev => prev.map(m =>
        m.id === streamingId
          ? {
              ...m,
              content: [
                explanationText || neutralizeModelSuccessClaim(aiContent) || CANDIDATE_GENERATED_NOTICE,
                transactionVerdict,
              ].filter(Boolean).join('\n\n'),

              thinking: thinkingSteps,
              claudeReasoning: aiReasoning,
              meta: responseMeta,
              taskPlan: { ...taskPlan },
              // DO NOT set `code` — we auto-apply instead of showing "Apply" buttons
              edits: edits.length > 0 ? edits : undefined,
              isStreaming: false,
            }
          : m
      ));

      // AUTO-APPLY: Push generated code to VFS — prefer orchestrator for dep resolution
      if (!multiFileOutput && canonicalCandidate?.dataOps?.length) {
        requireBuilderFeature(featuresRef.current, 'catalog');
        if (!canAutoApply('backend')) { setHeldFiles({ files: {}, candidate: canonicalCandidate, guestDemoOperationId: responseMeta?.guestDemoOperationId, reason: 'Review catalog changes before applying.' }); return; }
        markPreviewPending();
        const dataOutcome = await applyAIBuilderFiles(onApplyToVFS, {}, {
          prompt: userContent,
          model: modelUsed,
          origin: 'catalog-data',
          candidate: canonicalCandidate,
          summary: responseMeta?.reviewSummary,
          actionType: responseMeta?.actionType,
          guestDemoOperationId: responseMeta?.guestDemoOperationId,
        });
        if (dataOutcome.success) {
          const verification = await awaitPreviewVerification();
          if (verification.verified) toast.success('Catalog changes saved and confirmed in preview');
          else toast.warning('Catalog changes saved; preview confirmation is still pending');
          vfsEventBus.emit('ai:apply:complete', { filesWritten: [], source: 'catalog-data' });
        } else {
          toast.error('Catalog changes were not applied', { description: dataOutcome.errors?.[0] });
          if (responseMeta?.guestDemoOperationId) {
            void releaseGuestDemoReservation(responseMeta.guestDemoOperationId, 'canonical-commit-failed')
              .catch((error) => console.warn('[AIBuilderPanel] Guest reservation release failed', error));
          }
        }
      }

      if (!multiFileOutput && !canonicalCandidate?.dataOps?.length && responseMeta?.guestDemoOperationId) {
        void releaseGuestDemoReservation(responseMeta.guestDemoOperationId, 'no-canonical-mutation')
          .catch((error) => console.warn('[AIBuilderPanel] Guest reservation release failed', error));
      }

    }
    } catch (error) {
      console.error('[AIBuilderPanel] Error:', error);
      
      // ── Robust error extraction ──
      // supabase.functions.invoke throws FunctionsHttpError whose `.context`
      // is the raw Response object. We need to read it properly.
        let errorMessage = 'Unknown error';

      // Helper: try to pull a message from a FunctionsHttpError context
      const extractFromContext = async (ctx: unknown): Promise<string | null> => {
        try {
          // ctx may be a Response object (has .json()) or a plain object with .body
          if (ctx && typeof ctx === 'object') {
            if (typeof (ctx as Response).json === 'function') {
              const body = await (ctx as Response).json();
              if (body?.error) return body.error;
              if (body?.details) return `Validation error: ${JSON.stringify(body.details)}`;
            } else if ('body' in ctx) {
              const raw = (ctx as { body?: string }).body;
              if (raw) {
                const parsed = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
                if (parsed?.error) return parsed.error;
                if (parsed?.details) return `Validation error: ${JSON.stringify(parsed.details)}`;
              }
            }
          }
        } catch { /* swallow parse errors */ }
        return null;
      };

      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Try to extract the real error from FunctionsHttpError context
        const ctx = (error as any)?.context;
        if (ctx) {
          const extracted = await extractFromContext(ctx);
          if (extracted) {
            errorMessage = extracted;
          }
        }

        // Classify known error patterns for user-friendly messages
        if (errorMessage.includes('All AI providers failed') || errorMessage.includes('All AI models failed')) {
          errorMessage = 'AI service unavailable — all models are busy. Please try again in a moment.';
        } else if (errorMessage.includes('Rate limit') || errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          errorMessage = 'Too many requests. Please wait a moment and try again.';
        } else if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
          errorMessage = 'Request timed out. Try a shorter or simpler prompt.';
        } else if (errorMessage.includes('Payment required') || errorMessage.includes('402')) {
          errorMessage = 'AI credits needed. Please check your subscription or API billing.';
        } else if (errorMessage.includes('401') || errorMessage.includes('authentication')) {
          errorMessage = 'AI API key is invalid or expired. Please update your API key.';
        } else if (errorMessage.includes('not available') || errorMessage.includes('No AI provider is configured')) {
          errorMessage = 'AI service not configured. Please set your API key in project secrets.';
        } else if (errorMessage.includes('Invalid request body')) {
          errorMessage = 'Request was too large or malformed. Try a shorter prompt or fewer attached files.';
        } else if (errorMessage.includes('non-2xx status code') && !ctx) {
          // Fallback only if we couldn't extract a real message from context
          errorMessage = 'AI service returned an error. Try simplifying your request or try again in a moment.';
        }
      } else if (typeof error === 'object' && error !== null) {
        const err = error as { message?: string; context?: unknown };
        errorMessage = err.message || 'Edge function error';
        if (err.context) {
          const extracted = await extractFromContext(err.context);
          if (extracted) errorMessage = extracted;
        }
      }
      
      const providerUnavailable = isBuilderProviderUnavailable(errorMessage);
      const offerProviderRetry = shouldOfferBuilderProviderRetry(errorMessage, droppedFiles.length);
      if (offerProviderRetry && selectedTarget) setAgentTarget(selectedTarget);
      const sessionExpired = isBuilderSessionError(error);
      if (sessionExpired) {
        errorMessage = 'Your session expired. Please sign in again, then resend your request.';
      } else if (providerUnavailable) {
        errorMessage = 'AI is temporarily unavailable. This request was not applied; your original request and selected scope are preserved.';
      }
      const finalErrorContent = sessionExpired ? errorMessage : /^Too many requests\./i.test(errorMessage)
        ? `Sorry, I encountered an error: ${errorMessage}`
        : `Sorry, I encountered an error: ${errorMessage}. Please try again or simplify your request.`;
      const retryAsk = offerProviderRetry ? {
        question: 'ai-provider-retry',
        options: [{ label: 'Retry this request', reply: originalRequest }],
      } : undefined;

      setMessages(prev => {
        if (streamingId && prev.some(m => m.id === streamingId)) {
          const errorStep: ThinkingStep = {
            id: generateId(),
            type: 'error',
            message: 'Request failed',
            details: errorMessage,
            timestamp: new Date(),
          };

          return prev.map(m =>
            m.id === streamingId
              ? {
                  ...m,
                  content: finalErrorContent,
                  thinking: [...(m.thinking ?? []), errorStep],
                  isStreaming: false,
                  ask: retryAsk,
                }
              : m
          );
        }

        return [...prev, {
          id: generateId(),
          role: 'assistant',
          content: finalErrorContent,
          timestamp: new Date(),
          ask: retryAsk,
        }];
      });
    } finally {
      if (globalTimeout !== undefined) clearTimeout(globalTimeout);
      setIsLoading(false);
    }
  };

  // Fix iframe error with AI
  const handleFixError = async (error: IframeError) => {
    if (!featuresRef.current.repairs) { toast.error('Turn on error repairs in AI settings to continue.'); return; }
    setIsFixing(true);
    setActiveTab('code'); // Switch to code tab to show the fix

    const errorPrompt = `Fix this ${error.type} error:\n\nError: ${error.message}${error.stack ? `\n\nStack trace:\n${error.stack}` : ''}${error.file ? `\n\nFile: ${error.file}:${error.line}:${error.column}` : ''}`;

    const userMessage: Message = {
      id: generateId(),
      role: 'system',
      content: `🔧 Auto-fixing ${error.type} error...`,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const state = captureBuilderRequestState(getCurrentRequestState?.() ?? { files: vfsFiles ?? {}, revisionId: revisionId ?? null, projectId: projectId ?? null, businessId: businessId ?? null });
      const targetPath = error.file && state.files[error.file.startsWith('/') ? error.file : `/${error.file}`] !== undefined
        ? (error.file.startsWith('/') ? error.file : `/${error.file}`) : defaultTargetFile;
      if (targetPath && targetPath !== '/src/App.tsx' && /^\/src\/.+\.(?:tsx?|jsx?)$/.test(targetPath) && state.files[targetPath] !== undefined) {
        const page = resolveCanonicalAuthoringPage(state.files, targetPath);
        const registry = resolveBuilderRegistryContext({ vfsFiles: state.files, projectId: state.projectId, businessId: state.businessId, industry: systemType, templateId: templateName, pageRole: page.role });
        const catalogContext = await buildCatalogContext({ projectId: state.projectId, businessId: state.businessId, industry: systemType, selectedSection: null });
        assertBuilderRequestState(state, getCurrentRequestState?.() ?? state);
        const result = await unisonAppBuilder.repair({
          operationId: `debug:${generateId()}`, currentFiles: state.files, baseRevisionId: state.revisionId,
          page, sourceTargets: [targetPath], instruction: errorPrompt,
          diagnostics: [errorPrompt], registryContext: registry ?? undefined,
          connectorContext: { ...state, registryContext: registry, catalogSummary: renderCatalogContextForPrompt(catalogContext) },
          timeoutMs: 420_000,
        });
        if (result.candidate.status !== 'ready-for-commit' || !result.changeSet) throw new Error(result.candidate.diagnostics[0] ?? 'The repair did not pass validation.');
        const candidate = result.changeSet;
        const output = canonicalCandidateOutput(candidate);
        const category: AIEditPermissionCategory = error.type === 'supabase' ? 'backend' : 'behavioral';
        if (!canAutoApply(category)) {
          setHeldFiles({ ...output, routeOps: candidate.routeOps, candidate, reason: 'Review this repair before applying it.' });
          setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: 'Repair prepared for review. Your saved site is unchanged.', timestamp: new Date() }]);
          return;
        }
        assertBuilderRequestState(state, getCurrentRequestState?.() ?? state);
        const outcome = await applyAIBuilderFiles(onApplyToVFS, output.files, { origin: 'debug-fix', prompt: errorPrompt, summary: result.summary, deletions: output.deletions, routeOps: candidate.routeOps, candidate });
        if (!outcome.success) throw new Error(outcome.errors?.[0] ?? 'The repair could not be saved.');
        setMessages(prev => [...prev, { id: generateId(), role: 'assistant', content: result.summary ?? 'Saved the validated repair.', timestamp: new Date() }]);
        return;
      }
      throw new Error('Select an editable source page to repair. Legacy auto-fix is no longer available.');

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: `⚠️ Auto-fix failed: ${errMsg}\n\nTry describing the issue manually in the Code tab — include what you expected vs. what happened.`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsFixing(false);
    }
  };

  // handleApplyCode removed — code is now auto-applied to VFS

  // Handle viewing edits
  const handleViewEdits = (edits: VFSEdit[]) => {
    if (onViewEdits) {
      onViewEdits(edits);
    } else {
      toast.info('VFS file explorer will open with changes highlighted');
    }
  };


  // Whether to show conversational welcome (no real messages yet)
  const hasConversation = messages.some(m => m.role === 'user');

  return (
    <div className={cn(
      "unison-builder flex flex-col h-full bg-background",
      className
    )}>
      <header className="builder-header flex-wrap">
        <Sparkles className="text-primary" aria-hidden="true" />
        <div className="builder-header-title"><h2>Affinity</h2><p>{templateName || 'Your project'}</p></div>
        <span role="status" className="text-muted-foreground">{isLoading || isFixing ? 'Thinking' : heldFiles || pendingPermissionAction ? 'Review' : 'Ready'}</span>
        <BuilderSettings open={settingsOpen} onToggle={() => setSettingsOpen(value => !value)} features={features} onChange={setFeatures} permissions={aiPermissions} onPermissionsChange={setAIPermissions} busy={isLoading || isFixing} />
        {onClose && <Button variant="link" size="icon" onClick={onClose} title="Close Builder" aria-label="Close Builder"><ChevronLeft /></Button>}
      </header>

      {/* Tab bar */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col min-h-0">
        <TabsList className={cn('builder-nav w-full grid rounded-none h-9 bg-transparent px-1', customizerAvailable ? 'grid-cols-4' : 'grid-cols-3')}>
          <TabsTrigger
            value="code"
            className="text-xs gap-1.5 rounded-none h-8 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground text-muted-foreground transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
          </TabsTrigger>
          <TabsTrigger
            value="tools"
            disabled={!features.tools}
            className="text-[10px] gap-1 rounded-none h-8 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground text-muted-foreground transition-colors"
          >
            <Layers className="h-3.5 w-3.5" />
            Tools
          </TabsTrigger>
          {customizerAvailable && (
            <TabsTrigger
              value="customize"
              className="text-[10px] gap-1 rounded-none h-8 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground text-muted-foreground transition-colors"
            >
              <Palette className="h-3.5 w-3.5" />
              Style
            </TabsTrigger>
          )}
          <TabsTrigger
            value="backend"
            disabled={!features.capabilities}
            className="text-xs gap-1.5 rounded-none h-8 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground text-muted-foreground transition-colors"
          >
            <Database className="w-3.5 h-3.5" />
            Backend
          </TabsTrigger>
        </TabsList>

        <div role="tabpanel" aria-hidden={activeTab !== 'tools' || !features.tools} hidden={activeTab !== 'tools' || !features.tools} className="min-h-0 flex-1 overflow-hidden">
          <div ref={onToolsHostChange} className="h-full min-h-0 overflow-hidden" />
        </div>
        {onCustomizerHostChange && customizerAvailable && (
          <div role="tabpanel" aria-hidden={activeTab !== 'customize'} hidden={activeTab !== 'customize'} className="min-h-0 flex-1 overflow-hidden">
            <div ref={onCustomizerHostChange} className="h-full min-h-0 overflow-hidden" />
          </div>
        )}

        {/* Chat Tab */}
        <TabsContent value="code" className="flex-1 flex flex-col m-0 min-h-0 data-[state=inactive]:hidden">
          {/* Messages or Welcome */}
          <ScrollArea className="flex-1 sleek-scrollbar" ref={scrollRef}>
            <div className="py-3 px-3">
              {pendingPermissionAction && (
                <div className="mb-3 min-w-0 max-w-full overflow-hidden py-1 text-xs text-muted-foreground" role="status" aria-live="polite">
                  <p className="break-words">{pendingPermissionAction.title}</p>
                  <p className="mt-0.5 break-words leading-relaxed">{pendingPermissionAction.description}</p>
                  <div className="mt-1 flex items-baseline gap-3">
                    <button
                      type="button"
                      disabled={isApplyingPermissionAction}
                      onClick={() => void approvePendingPermissionAction()}
                      className="inline-flex items-center gap-1 text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      {isApplyingPermissionAction && <Loader2 className="h-3 w-3 animate-spin" />}
                      Apply change
                    </button>
                    <button
                      type="button"
                      disabled={isApplyingPermissionAction}
                      onClick={() => setPendingPermissionAction(null)}
                      className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
              <details><summary className="text-muted-foreground cursor-pointer">Project checks</summary><LaunchReadinessCard vfsFiles={vfsFiles} /><LayoutSnapshotCard vfsFiles={vfsFiles} /></details>
              {pendingCapabilityProposal && (
                <div className="mb-3 min-w-0 max-w-full overflow-hidden py-1 text-xs text-muted-foreground" role="status" aria-live="polite">
                  <p className="break-words text-foreground">
                    Turn on {pendingCapabilityProposal.plan.packs.map((pack) => pack.name).join(', ') || 'this feature'} for your site?
                  </p>
                  <p className="mt-1 break-words">{pendingCapabilityProposal.plan.proposal.summary}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-muted-foreground">Show details</summary>
                  {pendingCapabilityProposal.plan.packs.length > 0 && (
                    <p className="mt-2 text-muted-foreground">
                      Packs to install (in order): {pendingCapabilityProposal.plan.packs.map((pack) => pack.name).join(' → ')}
                    </p>
                  )}
                  <p className="mt-2 text-muted-foreground">Data affected: {pendingCapabilityProposal.plan.proposal.dataAffected.join(', ')}</p>
                  {pendingCapabilityProposal.plan.proposal.settingsRequired.accountFields.length > 0 && (
                    <p className="mt-1 text-muted-foreground">
                      Settings needed: {pendingCapabilityProposal.plan.proposal.settingsRequired.accountFields.join(', ')}
                    </p>
                  )}
                  <p className="mt-1 text-muted-foreground">Resolved bindings: {pendingCapabilityProposal.resolution.resolved.map((binding) => `${binding.filePath}#${binding.slot}`).join(', ') || 'none'}</p>
                  {(() => {
                    // Exactly what will run on the database if you approve.
                    const migration = previewCapabilityMigration(pendingCapabilityProposal.plan.packs);
                    if (migration.statements.length === 0) return null;
                    return (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-muted-foreground">
                          Backend changes on approval ({migration.statements.length} across {migration.tables.join(', ')})
                        </summary>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                          {migration.statements.map((statement) => (
                            <li key={statement.id}>{statement.description}</li>
                          ))}
                        </ul>
                        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap border border-border/50 bg-muted/40 p-2 text-[10px] text-muted-foreground">
                          {migration.sql}
                        </pre>
                      </details>
                    );
                  })()}
                  </details>
                  {pendingCapabilityProposal.plan.proposal.unsupportedCapabilities.length > 0 && (
                    <p className="mt-1 text-amber-500">
                      Not covered by a pack yet: {pendingCapabilityProposal.plan.proposal.unsupportedCapabilities.join(', ')}
                    </p>
                  )}

                  {pendingCapabilityProposal.resolution.unresolved.length > 0 && (
                    <p className="mt-2 text-destructive">Cannot approve until these targets exist: {pendingCapabilityProposal.resolution.unresolved.map((binding) => binding.target).join(', ')}</p>
                  )}
                  <div className="mt-2 flex items-baseline gap-3">
                    <button
                      type="button"
                      disabled={!features.capabilities || pendingCapabilityProposal.isApplying || pendingCapabilityProposal.resolution.unresolved.length > 0 || !onApproveCapabilityPlan}
                      onClick={async () => {
                        if (!onApproveCapabilityPlan || !featuresRef.current.capabilities) return;
                        setPendingCapabilityProposal((current) => current ? { ...current, isApplying: true } : current);
                        const outcome = await onApproveCapabilityPlan(
                          pendingCapabilityProposal.plan,
                          pendingCapabilityProposal.resolution,
                        );
                        if (outcome.success) {
                          toast.success('Done — it is set up and connected to your site');
                          setPendingCapabilityProposal(null);
                        } else {
                          toast.error('Business capability plan was not applied', { description: outcome.error });
                          setPendingCapabilityProposal((current) => current ? { ...current, isApplying: false } : current);
                        }
                      }}
                      className="inline-flex items-center gap-1 text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      {pendingCapabilityProposal.isApplying && <Loader2 className="h-3 w-3 animate-spin" />}
                      Turn on
                    </button>
                    <button
                      type="button"
                      disabled={pendingCapabilityProposal.isApplying}
                      onClick={() => setPendingCapabilityProposal(null)}
                      className="underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                    >
                      Not now
                    </button>
                  </div>
                </div>
              )}
              {!hasConversation ? (
                <AIConversationWelcome
                  onSelectPrompt={(prompt) => {
                    pendingPromptRef.current = prompt;
                    setInput(prompt);
                  }}
                  templateName={templateName}
                />
              ) : (
                messages.map((msg) => (
                  <div key={msg.id}>
                    <AIConversationMessage
                      message={msg}
                      onViewEdits={handleViewEdits}
                      onRetryError={handleFixError}
                    />
                    {msg.ask && (
                      <div className="mb-3 ml-10 flex flex-wrap gap-2" role="group" aria-label="Choose an answer">
                        {msg.ask.answer ? (
                          <span className="text-xs text-muted-foreground">You chose: {msg.ask.answer}</span>
                        ) : msg.ask.options.map((option, idx) => (
                          <Button
                            key={option.label}
                            size="sm"
                            variant={idx === 0 ? 'default' : 'outline'}
                            disabled={isLoading}
                            onClick={() => answerAsk(msg.id, option, idx === 0 && msg.ask?.question === 'setup-or-design')}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
              <AgentActivityFeed active={isLoading} />
              {features.repairs && <DebugAgentPanel
                embedded
                iframeErrors={iframeErrors}
                onFixError={handleFixError}
                onDebugRequest={(prompt) => {
                  void handleFixError({ type: 'runtime', message: prompt, timestamp: new Date() });
                }}
                onClearErrors={onClearErrors}
                onApplyPatch={async () => ({ success: false, errors: ['Request a validated repair through Affinity.'] })}
                canAutoApplyPatch={false}
                onReviewPatch={() => toast.info('Describe the repair in Affinity chat to prepare a validated candidate.')}
                vfsFiles={vfsFiles}
                isFixing={isFixing}
              />}

            </div>
          </ScrollArea>

          {features.tools && <AgentCommandPalette files={vfsFiles ?? {}} onApply={onApplyToVFS} onAsk={setInput} businessId={businessId} revisionId={revisionId} projectId={projectId} getCurrentRequestState={getCurrentRequestState} features={features} />}
          {agentTarget && (
            <div className="builder-context" role="status" aria-live="polite">
              <span className="truncate">
                Editing: <span className="text-foreground">&lt;{agentTarget.tagName}&gt;{agentTarget.text ? ` “${agentTarget.text}”` : ''}</span>
              </span>
              <button
                type="button"
                className="ml-auto shrink-0 rounded px-1 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setAgentTarget(null)}
                aria-label="Stop targeting this element"
              >
                ×
              </button>
            </div>
          )}
          {heldFiles && (
            <div
              className="builder-context"
              role="status"
              aria-live="polite"
            >
              <span
                className="min-w-0 flex-1 truncate"
                title={`${heldFiles.reason} ${Object.keys(heldFiles.files).join(', ')}`}
              >
                {heldFiles.reason}
                <span className="text-foreground/80"> {Object.keys(heldFiles.files).join(', ')}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                {isApplyingHeld && <Loader2 className="h-3 w-3 animate-spin" />}
                <button
                  type="button"
                  disabled={isApplyingHeld}
                  className="text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={async () => {
                    if (heldFiles.candidate?.dataOps?.length && !featuresRef.current.catalog) { toast.error('Turn on catalog edits in AI settings before applying.'); return; }
                    const pending = heldFiles.files;
                    const deletions = heldFiles.deletions;
                    const routeOps = heldFiles.routeOps;
                    const candidate = heldFiles.candidate;
                    const guestDemoOperationId = heldFiles.guestDemoOperationId;
                    setIsApplyingHeld(true);
                    const outcome = await applyAIBuilderFiles(onApplyToVFS, pending, { origin: 'held-review', deletions, routeOps, candidate, guestDemoOperationId });
                    setIsApplyingHeld(false);
                    if (outcome.success) {
                      setHeldFiles(null);
                      toast.success('Held changes applied to your project');
                    } else {
                      toast.error('Apply failed', { description: outcome.errors?.[0] });
                      setHeldFiles({ files: pending, deletions, routeOps, candidate, guestDemoOperationId, reason: outcome.errors?.[0] ?? 'Apply failed.' });
                    }
                  }}
                >
                  Apply
                </button>
                <button
                  type="button"
                  disabled={isApplyingHeld}
                  className="disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    setHeldFiles(null);
                    if (heldFiles.guestDemoOperationId) {
                      void releaseGuestDemoReservation(heldFiles.guestDemoOperationId, 'user-discard')
                        .catch((error) => console.warn('[AIBuilderPanel] Guest reservation release failed', error));
                    }
                  }}
                >
                  Discard
                </button>
              </span>
            </div>
          )}
          <FileActivityRibbon active={isLoading} onOpenFile={onOpenFile} />
          {/* Input */}
          <AIConversationInput
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            isLoading={isLoading}
            droppedFiles={droppedFiles}
            onAddFiles={addFiles}
            onRemoveFile={removeFile}
            previewRef={previewRef}
          />
          <div className="builder-actions">
            {features.tools && <Button variant="link" onClick={() => window.dispatchEvent(new Event('unison:open-command-tools'))}>Tools</Button>}
            {features.catalog && <CatalogPanel files={vfsFiles ?? {}} businessId={businessId} onApply={onApplyToVFS} />}
            <details><summary className="text-muted-foreground cursor-pointer">Model</summary><AIGatewayOptions config={gatewayConfig} onChange={config => { saveAppBuilderAISettings(config); setGatewayConfig(config); }} /></details>
          </div>
        </TabsContent>

        {/* Backend Tab — full-stack proposal review + approval surface */}
        <TabsContent value="backend" className="flex-1 flex flex-col m-0 min-h-0 data-[state=inactive]:hidden">
          {features.capabilities && <MigrationProposalPanel
            projectId={projectId ?? undefined}
            businessId={businessId ?? undefined}
            className="flex-1 min-h-0"
          />}
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default AIBuilderPanel;
