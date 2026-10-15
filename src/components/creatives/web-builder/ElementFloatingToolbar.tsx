import { RecordFieldsEditor } from './RecordFieldsEditor';
/**
 * ElementFloatingToolbar - Context-Sensitive Toolbar for Element-Level Editing
 *
 * Appears above/below selected elements in the preview.
 * Provides quick access to typography, colors, spacing, actions, and
 * a full inline AI chat panel for natural-language element edits.
 */

import React, { useState, useCallback, useEffect, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Type, Palette, Trash2, Copy, MoveUp, MoveDown, Edit3,
  ChevronDown, Image, Maximize2, Undo2, Sparkles,
  Send, X, Loader2, AlertCircle, CheckCircle2, Link2, Eye, EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeVfsForAI } from '@/utils/sanitizeVfsForAI';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
const supabase = supabaseClient as any;
import { toast } from 'sonner';
import type { SystemsBuildContext } from '@/types/systemsBuildContext';
import type { BusinessSystemType } from '@/data/templates/types';
import {
  resolveEditScope,
  defaultScopeFor,
  formatScopeLabel,
  buildScopedPromptPrefix,
  type EditScopeType,
  type ScopeAncestors,
} from '@/services/editScopeResolver';
import { buildWebBuilderAIContext } from '@/utils/aiAssistantContext';
import { buildCatalogContext, renderCatalogContextForPrompt, type SelectedSectionRef } from '@/utils/catalogContext';
import runBuilderTurn from '@/services/builderBrainClient';
import { useToolbarCommands } from './toolbarCommandAdapter';
import { uploadForPlacement } from '@/services/assets/uploadPlacement';
import { IMAGE_GENERATED_EVENT, type ImageGeneratedDetail } from '@/services/media/generateSiteImage';
import { coverBackgroundStyles } from './pictureInsertion';
import { selectionEvidence } from './jsxSourceUtils';
import type { EditorTarget } from '@/services/editor/editorCommandTypes';
import { descriptorToTarget, type EditableObjectDescriptor } from '@/services/editor/editableObjectDescriptor';
import { resolveSlotSectionType } from '@/services/builder/propertyInspectorModel';

interface SelectedElement {
  tagName?: string;
  textContent?: string;
  styles?: Record<string, string>;
  attributes?: Record<string, string>;
  selector?: string;
  html?: string;
  section?: string;
  imageTarget?: {
    kind: 'img' | 'background';
    selector: string;
    src?: string;
  } | null;
  /** Captured by the Preview selection bridge — drives EditScopeResolver. */
  scopeAncestors?: ScopeAncestors;
  descriptor?: EditableObjectDescriptor;
}

interface ElementFloatingToolbarProps {
  element: SelectedElement | null;
  onUpdateStyles: (selector: string, styles: Record<string, string>) => void;
  onUpdateText: (selector: string, text: string, target: EditorTarget) => void | boolean | Promise<void | boolean>;
  onUpdateAttributes?: (selector: string, attributes: Record<string, string>) => void;
  onReplaceImage: (selector: string, src: string) => void;
  onDelete: (selector: string) => void;
  onDuplicate: (selector: string) => void;
  onClear: () => void;
  /** Move element/section up in DOM order */
  onMoveUp?: (selector: string) => void;
  /** Move element/section down in DOM order */
  onMoveDown?: (selector: string) => void;
  /**
   * Called with the selector and AI-generated HTML snippet.
   * Return true/void to confirm the update was applied, false to signal failure.
   */
  onAIEditComplete?: (selector: string, html: string) => boolean | Promise<boolean>;
  /** Legacy — kept for backward compatibility; prefer onAIEditComplete */
  onRequestAI?: (selector: string) => void;
  className?: string;
  /** Business system type for context-aware AI edits (e.g. 'salon', 'restaurant') */
  systemType?: BusinessSystemType | null;
  /** Full business blueprint from systems-build for richer AI context */
  systemsBuildContext?: SystemsBuildContext | null;
  /** Builder identity — enables Lane B catalog/backend context injection. */
  businessId?: string | null;
  projectId?: string | null;
  industry?: string | null;
  templateName?: string | null;
  /** Active page path in the VFS (e.g. `/src/pages/Home.tsx`). */
  activePagePath?: string | null;
  /** Snapshot of the current VFS — sent to Lane B so the AI can reason across files. */
  getVFSFiles?: () => Record<string, string>;
  readiness?: {
    surfaceLabel?: string;
    previewStatus?: 'ready' | 'partial' | 'blocked' | 'draft' | 'stubbed';
    publishStatus?: 'ready' | 'partial' | 'blocked' | 'draft' | 'stubbed';
    missingDependencies?: string[];
    onOpenSetup?: () => void;
    /** Move E — per-element readiness derived from latest site_revisions row. */
    ledgerIntent?: string;
    ledgerStatus?: 'ready' | 'capability-missing' | 'rows-missing' | 'unbound' | 'unknown-intent';
    ledgerBlocker?: string;
    ledgerFixPath?: string;
  } | null;
}

const FONT_OPTIONS = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Playfair Display', 'Merriweather', 'DM Sans', 'Space Grotesk',
  'Outfit', 'Manrope', 'JetBrains Mono',
];

const SIZE_OPTIONS = ['12', '14', '16', '18', '20', '24', '28', '32', '36', '42', '48', '56', '64', '72'];

function getDefaultDisplay(tagName?: string) {
  const tag = (tagName || '').toLowerCase();
  if (['span', 'a', 'label', 'strong', 'em'].includes(tag)) return 'inline';
  if (['img', 'button', 'input', 'select', 'textarea'].includes(tag)) return 'inline-block';
  return 'block';
}

function extractCssUrl(value?: string): string {
  if (!value || value === 'none') return '';
  const match = value.match(/url\((['"]?)(.*?)\1\)/i);
  return match?.[2] || '';
}

// ─── Inline AI Panel ─────────────────────────────────────────────────────────

interface InlineAIPanelProps {
  element: SelectedElement;
  onClose: () => void;
  onAIEditComplete?: (selector: string, html: string) => boolean | Promise<boolean>;
  onRequestAI?: (selector: string) => void;
  systemType?: BusinessSystemType | null;
  systemsBuildContext?: SystemsBuildContext | null;
  businessId?: string | null;
  projectId?: string | null;
  industry?: string | null;
  templateName?: string | null;
  activePagePath?: string | null;
  getVFSFiles?: () => Record<string, string>;
}

const InlineAIPanel: React.FC<InlineAIPanelProps> = ({
  element,
  onClose,
  onAIEditComplete,
  onRequestAI,
  systemType,
  systemsBuildContext,
  businessId,
  projectId,
  industry,
  templateName,
  activePagePath,
  getVFSFiles,
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Edit scope resolution (Preview floating toolbar) ─────────────────
  // User can override default scope (element / block / section) so AI edits
  // are clipped to the exact artifact they care about.
  const ancestors: ScopeAncestors = element.scopeAncestors || {
    elementId: null,
    slotId: null,
    blockId: null,
    sectionId: element.section || null,
    pageId: null,
    intents: [],
    clickedTag: element.tagName || null,
  };
  const autoScope = defaultScopeFor(ancestors);
  const [scopeOverride, setScopeOverride] = useState<EditScopeType | null>(null);
  const activeScopeType: EditScopeType = scopeOverride || autoScope;
  const editScope = resolveEditScope({
    ancestors,
    selectedScope: activeScopeType,
  });

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || loading) return;
    const selector = element.selector!;

    // Fall back to legacy modal when no inline handler is provided
    if (!onAIEditComplete) {
      onRequestAI?.(selector);
      onClose();
      return;
    }

    // Artifact registry contract (Stage 1): a locked artifact must never
    // reach Lane B, regardless of DOM scope override.
    if (!editScope.aiEditable) {
      setError('This element is locked for AI edits. Use the manual editor or Business Center for this content.');
      return;
    }

    // The toolbar is a front-end of the AI Builder: hand the clicked element and
    // the request to the one Builder agent (context, catalog, button-destination
    // check, activity list, canonical save). No separate AI call here.
    const attrs = (element.attributes ?? {}) as Record<string, string>;
    const section = (element as { section?: unknown }).section as { id?: string; label?: string } | string | undefined;
    window.dispatchEvent(new CustomEvent('unison:builder-send', { detail: {
      prompt: trimmedPrompt,
      target: {
        tagName: String(element.tagName ?? '').toLowerCase(),
        text: String(element.textContent ?? '').trim().slice(0, 80),
        selector,
        section: typeof section === 'string' ? section : section?.id ?? section?.label,
        intent: attrs['data-ut-intent'],
        imageKind: element.imageTarget?.kind === 'img' || String(element.tagName).toLowerCase() === 'img' ? 'img' : element.imageTarget ? 'background' : undefined,
        imageSelector: element.imageTarget?.selector || selector,
        scopeAncestors: ancestors,
        provenance: {
          sourceTable: ancestors.sourceTable,
          rowId: ancestors.rowId,
          field: ancestors.field,
          bindingId: ancestors.bindingId,
          targetPath: ancestors.targetPath,
          // Resource Runtime identity (key#recordId.field) so the Builder edits the record, not the markup.
          resource: attrs['data-ut-resource'] || (ancestors as { resource?: string | null }).resource || undefined,
        },
      },
    } }));
    setSuccess(true);
    setPrompt('');
    setTimeout(() => onClose(), 900);
  }, [prompt, loading, element, onAIEditComplete, onRequestAI, onClose, editScope, systemType, systemsBuildContext, businessId, projectId, industry, templateName, activePagePath, getVFSFiles, ancestors]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="w-full border-t border-white/10 pt-2 mt-1 animate-in fade-in-0 slide-in-from-top-1">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
        <span className="text-[10px] font-semibold text-cyan-300 shrink-0">AI Edit</span>
        <span className="text-[10px] text-white/40 truncate max-w-[160px]">
          {element.tagName?.toUpperCase()}
          {element.selector ? ` · ${element.selector.slice(0, 22)}` : ''}
        </span>
        <button
          onClick={onClose}
          className="ml-auto text-white/30 hover:text-white/70 transition-colors"
          title="Close AI panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scope chips — Element | Block | Section. Default is the auto-derived
          scope from EditScopeResolver; user can override per prompt. */}
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-[9px] uppercase tracking-wider text-white/40 mr-1">Scope:</span>
        {(['element', 'block', 'section'] as EditScopeType[]).map((s) => {
          const isActive = activeScopeType === s;
          const isAuto = autoScope === s && !scopeOverride;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setScopeOverride(s === autoScope ? null : s)}
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded border transition-colors capitalize',
                isActive
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                  : 'bg-white/[0.04] border-white/10 text-white/50 hover:text-white/80',
              )}
              title={isAuto ? 'Auto-selected scope' : `Override scope to ${s}`}
            >
              {s}{isAuto ? ' •' : ''}
            </button>
          );
        })}
        <span className="ml-auto text-[9px] text-white/40 truncate max-w-[150px]" title={formatScopeLabel(editScope)}>
          {formatScopeLabel(editScope)}
        </span>
      </div>



      {/* Input row */}
      <div className="flex items-end gap-1.5">
        <Textarea
          ref={inputRef}
          value={prompt}
          onChange={e => { setPrompt(e.target.value); setError(null); }}
          onKeyDown={handleKeyDown}
          placeholder={
            editScope.aiEditable
              ? `Describe changes to this ${element.tagName || 'element'}… (Enter to send, Shift+Enter for newline)`
              : 'This element is locked for AI edits — use the manual editor or Business Center.'
          }
          rows={2}
          disabled={loading || success || !editScope.aiEditable}
          className={cn(
            'flex-1 min-w-0 resize-none text-xs py-1.5 px-2.5 rounded-lg',
            'bg-white/[0.07] border-white/10 text-white placeholder:text-white/30',
            'focus-visible:ring-1 focus-visible:ring-cyan-400/60 focus-visible:border-cyan-400/40',
            'transition-all',
          )}
        />
        <Button
          onClick={handleSubmit}
          disabled={!prompt.trim() || loading || success || !editScope.aiEditable}
          size="sm"
          className={cn(
            'h-[54px] w-9 p-0 shrink-0 rounded-lg',
            'bg-cyan-500 hover:bg-cyan-400 text-black',
            'disabled:opacity-50',
            'shadow-[0_0_12px_rgba(0,255,255,0.35)]',
          )}
          title="Send (Enter)"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : success ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-900" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </Button>
      </div>

      {/* Status */}
      {error && (
        <div className="flex items-start gap-1 mt-1.5 text-[10px] text-red-400">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          <span role="status">Sent to the AI Builder — follow progress in the chat.</span>
        </div>
      )}
      {!error && !success && (
        <p className="text-[9px] text-white/25 mt-1">Shift+Enter for new line · Esc to close</p>
      )}
    </div>
  );
};

// ─── Main Toolbar ─────────────────────────────────────────────────────────────

export const ElementFloatingToolbar: React.FC<ElementFloatingToolbarProps> = ({
  element,
  onUpdateStyles,
  onUpdateText,
  onUpdateAttributes,
  onReplaceImage,
  onDelete,
  onDuplicate,
  onClear,
  onMoveUp,
  onMoveDown,
  onAIEditComplete,
  onRequestAI,
  className,
  systemType,
  systemsBuildContext,
  businessId,
  projectId,
  industry,
  templateName,
  activePagePath,
  getVFSFiles,
  readiness,
}) => {
  const [isEditingText, setIsEditingText] = useState(false);
  const [editText, setEditText] = useState('');
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [attributeDraft, setAttributeDraft] = useState<Record<string, string>>({});
  const [imageUrlDraft, setImageUrlDraft] = useState('');
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageGenerating, setImageGenerating] = useState(false);
  // Asked each time: background vs image inside, and this card vs every card.
  const [placement, setPlacement] = useState<'background' | 'inside' | null>(null);
  const [groupScope, setGroupScope] = useState<'one' | 'group' | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (element?.textContent) setEditText(element.textContent);
    setAttributeDraft({
      href: element?.attributes?.href || '',
      'data-ut-path': element?.attributes?.['data-ut-path'] || '',
      'data-ut-url': element?.attributes?.['data-ut-url'] || '',
      'aria-label': element?.attributes?.['aria-label'] || '',
      alt: element?.attributes?.alt || '',
    });
    setImageUrlDraft(element?.imageTarget?.src || element?.attributes?.src || extractCssUrl(element?.styles?.backgroundImage) || '');
    setPlacement(null);
    setGroupScope(null);
    setIsEditingText(false);
    setIsAIOpen(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }, [element]);

  // Every toolbar action goes through the shared EditorCommandService (§25):
  // lane resolution + capability check first, host commit handlers second.
  const runCommand = useToolbarCommands(
    { onUpdateStyles, onUpdateText, onUpdateAttributes, onReplaceImage, onDelete, onDuplicate, onMoveUp, onMoveDown },
    { businessId: businessId ?? undefined, projectId: projectId ?? undefined },
  );

  if (!element || !element.selector) return null;

  const selector = element.selector;
  const slotId = element.scopeAncestors?.slotId ?? null;
  const descriptorTarget = element.descriptor ? descriptorToTarget(element.descriptor) : {};
  const resourceMark = element.attributes?.['data-ut-resource'] || (element.scopeAncestors as { resource?: string | null } | undefined)?.resource || null;
  const target: EditorTarget = {
    ...descriptorTarget,
    selector,
    pagePath: element.scopeAncestors?.pagePath || activePagePath || undefined,
    sectionId: element.scopeAncestors?.sectionId ?? element.descriptor?.sectionId ?? null,
    sectionType: resolveSlotSectionType(element.scopeAncestors?.sectionType, slotId),
    slotId,
    resourceMark: element.attributes?.['data-ut-resource'] ?? descriptorTarget.resourceMark ?? null,
  };
  const styles = element.styles || {};
  const isImage = element.tagName?.toLowerCase() === 'img';
  const backgroundImage = styles.backgroundImage || '';
  // Only a real picture counts — plain colors/gradients mean "add a picture".
  const hasBackgroundImage = /url\(/i.test(backgroundImage);
  const imageTarget = element.imageTarget || (isImage ? { kind: 'img' as const, selector, src: element.attributes?.src } : null);
  const hasImageControls = !!imageTarget || hasBackgroundImage;
  const tagLower = (element.tagName || '').toLowerCase();
  // Sections, cards and other containers can receive a picture even when they have none.
  const canHostPicture = hasImageControls || ['section', 'div', 'article', 'header', 'footer', 'aside', 'main', 'li', 'figure', 'a', 'button'].includes(tagLower);
  const needsPlacement = !hasImageControls;
  const hasText = String(element.textContent ?? '').trim().length > 0;
  // Repeated only when the clicked element itself is one of several matching siblings (cards in a grid).
  const isRepeat = /\[\]$/.test(String((element.scopeAncestors as { structuralPath?: string } | undefined)?.structuralPath ?? ''));
  const choicesReady = (!needsPlacement || !!placement) && (!isRepeat || !!groupScope);
  const isTextElement = ['h1','h2','h3','h4','h5','h6','p','span','a','button','li','label','td','th'].includes(
    (element.tagName || '').toLowerCase()
  );
  const hasAI = !!(onAIEditComplete || onRequestAI);
  const isLinkLike = ['a', 'button'].includes((element.tagName || '').toLowerCase()) || !!element.attributes?.href || !!element.attributes?.['data-ut-path'] || !!element.attributes?.['data-ut-url'];
  const isHidden = styles.display === 'none' || element.attributes?.hidden === 'true';

  const currentFontSize = parseInt(styles.fontSize || '16');
  const currentFontWeight = styles.fontWeight || '400';
  const currentFontStyle = styles.fontStyle || 'normal';
  const currentTextDecoration = styles.textDecoration || 'none';
  const currentTextAlign = styles.textAlign || 'left';
  const currentColor = styles.color || '#000000';
  const currentBgColor = styles.backgroundColor || 'transparent';

  const updateStyle = (prop: string, value: string) => {
    void runCommand({ type: 'set-style', target, styles: { [prop]: value } });
  };

  const replaceImage = (src: string) => {
    const nextSrc = src.trim();
    if (!nextSrc || !choicesReady) return;
    if (needsPlacement && placement === 'inside') {
      // Same save path as AI-generated pictures.
      window.dispatchEvent(new CustomEvent<ImageGeneratedDetail>(IMAGE_GENERATED_EVENT, { detail: {
        selector, src: nextSrc, kind: 'img', placement: 'inside', text: String(element.textContent ?? '').trim().slice(0, 200), evidence: selectionEvidence(element), pagePath: target.pagePath ?? undefined,
      } }));
      return;
    }
    if (needsPlacement) {
      void runCommand({ type: 'set-style', target, styles: coverBackgroundStyles(nextSrc, hasText) });
      return;
    }
    if (imageTarget?.kind === 'img') {
      void runCommand({ type: 'replace-asset', target: { ...target, selector: imageTarget.selector || selector }, url: nextSrc });
      return;
    }
    void runCommand({
      type: 'set-style',
      target: { ...target, selector: imageTarget?.selector || selector },
      styles: { backgroundImage: `url("${nextSrc.replace(/"/g, '%22')}")` },
    });
  };

  const handleTextSave = () => {
    if (editText.trim() !== element.textContent) {
      void runCommand({ type: 'set-text', target, text: editText.trim() });
    }
    setIsEditingText(false);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    // M2: upload into this site's storage and place a durable link — never
    // embed the file as inline data in page source or saved records.
    const pending = toast.loading('Uploading image…');
    void uploadForPlacement(file, projectId ?? null)
      .then((placed) => { toast.dismiss(pending); replaceImage(placed.url); })
      .catch((err) => { toast.dismiss(pending); toast.error(err instanceof Error ? err.message : 'Upload failed'); })
      .finally(() => { if (imageInputRef.current) imageInputRef.current.value = ''; });
  };

  // The image box is a front-end of the AI Builder's image extension: same agent,
  // same site context, same save path. No separate image call here.
  const handleImageGenerate = async () => {
    const p = imagePrompt.trim();
    if (!p || imageGenerating || !choicesReady) return;
    setImageGenerating(true);
    const section = (element as { section?: unknown }).section as { id?: string; label?: string } | string | undefined;
    const attrs = (element.attributes ?? {}) as Record<string, string>;
    const rect = (element as { rect?: { width?: number; height?: number } }).rect;
    window.dispatchEvent(new CustomEvent('unison:builder-send', { detail: {
      prompt: p,
      target: {
        tagName: String(element.tagName ?? '').toLowerCase(),
        text: String(element.textContent ?? '').trim().slice(0, 400),
        selector,
        section: typeof section === 'string' ? section : section?.id ?? section?.label,
        imageKind: needsPlacement ? (placement === 'inside' ? 'img' : 'background') : imageTarget?.kind ?? 'background',
        imageSelector: imageTarget?.selector || selector,
        imageSrc: imageTarget?.src || attrs.src || extractCssUrl(element.styles?.backgroundImage) || undefined,
        imageAlt: attrs.alt,
        width: rect?.width, height: placement === 'inside' && rect?.width ? Math.round(rect.width * 9 / 16) : rect?.height,
        forceImage: true,
        placement: needsPlacement ? placement : undefined,
        scrim: needsPlacement && placement === 'background' && hasText,
        scope: isRepeat ? groupScope : undefined,
        evidence: selectionEvidence(element),
        ownerPath: element.descriptor?.sourceLocator?.startsWith('/') ? element.descriptor.sourceLocator.split(':')[0] : undefined,
        pagePath: target.pagePath ?? undefined,
        descriptor: element.descriptor,
      },
    } }));
    setImagePrompt('');
    window.setTimeout(() => setImageGenerating(false), 1500);
  };

  const handleImageUrlApply = () => {
    replaceImage(imageUrlDraft);
  };

  const handleAttributeSave = () => {
    if (!onUpdateAttributes) return;
    Object.entries(attributeDraft).forEach(([key, value]) => {
      void runCommand({ type: 'set-attribute', target, name: key, value: value.trim() });
    });
  };

  return (
    <div className={cn(
      'flex flex-col gap-0 rounded-lg border border-white/[0.08] bg-[#0d0d18]/95 p-1.5 shadow-[0_18px_44px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl',
      'animate-in fade-in-0 slide-in-from-bottom-1 duration-150',
      className
    )}>
      <RecordFieldsEditor
        key={resourceMark ?? 'unmarked'}
        mark={resourceMark}
        businessId={businessId}
        projectId={projectId}
        defaultOpen={Boolean(resourceMark)}
      />

      {readiness && (
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 border-b border-white/[0.06] px-1.5 py-1.5">
          {readiness.surfaceLabel ? (
            <span className="text-[10px] font-semibold text-cyan-300">{readiness.surfaceLabel}</span>
          ) : null}
          {readiness.previewStatus ? (
            <span className={cn(
              "rounded-md px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
              readiness.previewStatus === "ready"
                ? "bg-emerald-500/15 text-emerald-300"
                : readiness.previewStatus === "blocked"
                  ? "bg-red-500/15 text-red-300"
                  : "bg-amber-500/15 text-amber-300",
            )}>
              Preview {readiness.previewStatus}
            </span>
          ) : null}
          {readiness.publishStatus ? (
            <span className={cn(
              "rounded-md px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
              readiness.publishStatus === "ready"
                ? "bg-emerald-500/15 text-emerald-300"
                : readiness.publishStatus === "blocked"
                  ? "bg-red-500/15 text-red-300"
                  : "bg-amber-500/15 text-amber-300",
            )}>
              Publish {readiness.publishStatus}
            </span>
          ) : null}
          {readiness.missingDependencies?.length ? (
            <span className="max-w-[240px] truncate text-[10px] text-white/55">
              {readiness.missingDependencies.join(", ")}
            </span>
          ) : null}
          {readiness.ledgerStatus ? (() => {
            const s = readiness.ledgerStatus!;
            const tone =
              s === 'ready'
                ? 'bg-emerald-500/15 text-emerald-300'
                : s === 'rows-missing' || s === 'capability-missing'
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-red-500/15 text-red-300';
            const label =
              s === 'ready'
                ? 'Ledger ready'
                : s === 'rows-missing'
                  ? 'Needs data'
                  : s === 'capability-missing'
                    ? 'Needs setup'
                    : s === 'unbound'
                      ? 'Unbound'
                      : 'Unknown intent';
            return (
              <span
                className={cn('rounded-md px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide', tone)}
                title={[readiness.ledgerIntent, readiness.ledgerBlocker].filter(Boolean).join(' — ')}
              >
                {label}
              </span>
            );
          })() : null}
          {readiness.ledgerBlocker ? (
            <span className="max-w-[240px] truncate text-[10px] text-white/55" title={readiness.ledgerBlocker}>
              {readiness.ledgerBlocker}
            </span>
          ) : null}
          {readiness.onOpenSetup && readiness.publishStatus && readiness.publishStatus !== "ready" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={readiness.onOpenSetup}
              className="ml-auto h-6 border-amber-500/30 bg-amber-500/10 px-2 text-[10px] text-amber-300 hover:bg-amber-500/20"
            >
              Needs Setup
            </Button>
          ) : null}
        </div>
      )}
      {/* ── Buttons row ── */}
      <div className="flex flex-wrap items-center gap-1">
        {/* Element badge */}
        <div className="px-2 py-1 text-[10px] font-semibold uppercase text-white/55">
          {element.tagName || 'element'}
        </div>

        <Separator orientation="vertical" className="h-6 mx-0.5 bg-white/[0.1]" />

        {/* Text editors */}
        {isTextElement && (
          <>
            {isEditingText ? (
              <div className="flex items-center gap-1">
                <Input
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleTextSave(); if (e.key === 'Escape') setIsEditingText(false); }}
                  className="h-7 text-xs w-40"
                  autoFocus
                />
                <Button size="sm" onClick={handleTextSave} className="h-7 text-xs px-2">Save</Button>
                <Button variant="ghost" size="sm" onClick={() => setIsEditingText(false)} className="h-7 text-xs px-2">Cancel</Button>
              </div>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setIsEditingText(true)} className="h-7 text-xs gap-1">
                <Edit3 className="w-3 h-3" />Edit Text
              </Button>
            )}

            <Separator orientation="vertical" className="h-6 mx-0.5 bg-white/[0.1]" />

            {/* Font size */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2">
                  <Type className="w-3 h-3" />{currentFontSize}px<ChevronDown className="w-2.5 h-2.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-3" align="start">
                <Label className="text-xs text-muted-foreground mb-2 block">Font Size</Label>
                <Slider value={[currentFontSize]} min={8} max={96} step={1} onValueChange={([v]) => updateStyle('fontSize', `${v}px`)} />
                <div className="flex flex-wrap gap-1 mt-2">
                  {SIZE_OPTIONS.map(s => (
                    <Button key={s} variant={currentFontSize === parseInt(s) ? 'secondary' : 'ghost'} size="sm" onClick={() => updateStyle('fontSize', `${s}px`)} className="h-6 text-[10px] px-1.5">{s}</Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Font style buttons */}
            <div className="flex items-center gap-0.5">
              <Button variant={currentFontWeight === 'bold' || parseInt(currentFontWeight) >= 700 ? 'secondary' : 'ghost'} size="sm" onClick={() => updateStyle('fontWeight', currentFontWeight === 'bold' || parseInt(currentFontWeight) >= 700 ? '400' : 'bold')} className="h-7 w-7 p-0"><Bold className="w-3.5 h-3.5" /></Button>
              <Button variant={currentFontStyle === 'italic' ? 'secondary' : 'ghost'} size="sm" onClick={() => updateStyle('fontStyle', currentFontStyle === 'italic' ? 'normal' : 'italic')} className="h-7 w-7 p-0"><Italic className="w-3.5 h-3.5" /></Button>
              <Button variant={currentTextDecoration === 'underline' ? 'secondary' : 'ghost'} size="sm" onClick={() => updateStyle('textDecoration', currentTextDecoration === 'underline' ? 'none' : 'underline')} className="h-7 w-7 p-0"><Underline className="w-3.5 h-3.5" /></Button>
            </div>

            {/* Alignment */}
            <div className="flex items-center gap-0.5">
              {(['left', 'center', 'right'] as const).map(align => {
                const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;
                return (
                  <Button key={align} variant={currentTextAlign === align ? 'secondary' : 'ghost'} size="sm" onClick={() => updateStyle('textAlign', align)} className="h-7 w-7 p-0">
                    <Icon className="w-3.5 h-3.5" />
                  </Button>
                );
              })}
            </div>

            <Separator orientation="vertical" className="h-6 mx-0.5 bg-white/[0.1]" />
          </>
        )}

        {/* Image replace — or add a picture to a section/card that has none */}
        {canHostPicture && (
          <>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2">
                  <Image className="w-3 h-3" />Image<ChevronDown className="w-2.5 h-2.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 space-y-3 p-3" align="start">
                {needsPlacement && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground block">Where should the picture go?</Label>
                    <div className="flex gap-2">
                      <Button variant={placement === 'background' ? 'default' : 'outline'} size="sm" className="h-8 flex-1 text-xs" onClick={() => setPlacement('background')}>As background</Button>
                      <Button variant={placement === 'inside' ? 'default' : 'outline'} size="sm" className="h-8 flex-1 text-xs" onClick={() => setPlacement('inside')}>Image inside</Button>
                    </div>
                  </div>
                )}
                {isRepeat && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground block">This is one of several matching cards</Label>
                    <div className="flex gap-2">
                      <Button variant={groupScope === 'one' ? 'default' : 'outline'} size="sm" className="h-8 flex-1 text-xs" onClick={() => setGroupScope('one')}>This card only</Button>
                      <Button variant={groupScope === 'group' ? 'default' : 'outline'} size="sm" className="h-8 flex-1 text-xs" onClick={() => setGroupScope('group')}>Every card</Button>
                    </div>
                    {groupScope === 'one' && (
                      <p className="text-xs text-muted-foreground">These cards share one design, so a picture added here appears on each of them. To give one card its own picture, link it to a saved item first.</p>
                    )}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground block">{needsPlacement ? 'Add a picture' : 'Swap image'}</Label>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => imageInputRef.current?.click()} disabled={!choicesReady}>
                      Upload
                    </Button>
                    <Input
                      value={imageUrlDraft}
                      onChange={(e) => setImageUrlDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && choicesReady) handleImageUrlApply(); }}
                      className="h-8 flex-1 text-xs"
                      placeholder="Paste image URL"
                    />
                    <Button size="sm" className="h-8 text-xs" onClick={handleImageUrlApply} disabled={!imageUrlDraft.trim() || !choicesReady}>
                      Apply
                    </Button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground block">Generate with AI</Label>
                  <Textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleImageGenerate(); } }}
                    className="min-h-[56px] text-xs"
                    placeholder="Describe the picture, e.g. warm studio interior at golden hour"
                    disabled={imageGenerating}
                  />
                  <Button size="sm" className="h-8 w-full text-xs gap-1" onClick={() => void handleImageGenerate()} disabled={!imagePrompt.trim() || imageGenerating || !choicesReady}>
                    {imageGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {imageGenerating ? 'Generating…' : choicesReady ? 'Generate and use' : 'Choose the options above first'}
                  </Button>
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1.5 text-[10px] text-muted-foreground">
                  Target: {needsPlacement ? (placement === 'inside' ? 'new image inside this element' : placement === 'background' ? `background${hasText ? ' (with a shade so text stays readable)' : ''}` : 'not chosen yet') : imageTarget?.kind === 'img' ? 'image source' : 'background image'}
                </div>
              </PopoverContent>
            </Popover>
            <Separator orientation="vertical" className="h-6 mx-0.5 bg-white/[0.1]" />
          </>
        )}

        {(isLinkLike || hasImageControls || onUpdateAttributes) && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2">
                  <Link2 className="w-3 h-3" />Attrs
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-3 p-3" align="start">
                {(isLinkLike || onUpdateAttributes) && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground block">Link / Route</Label>
                      {element.attributes?.href !== undefined && (
                        <Input
                          value={attributeDraft.href || ''}
                          onChange={(e) => setAttributeDraft((prev) => ({ ...prev, href: e.target.value }))}
                          className="h-8 text-xs"
                          placeholder="href"
                        />
                      )}
                      <Input
                        value={attributeDraft['data-ut-path'] || ''}
                        onChange={(e) => setAttributeDraft((prev) => ({ ...prev, 'data-ut-path': e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="data-ut-path"
                      />
                      <Input
                        value={attributeDraft['data-ut-url'] || ''}
                        onChange={(e) => setAttributeDraft((prev) => ({ ...prev, 'data-ut-url': e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="data-ut-url"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground block">Accessibility</Label>
                      <Input
                        value={attributeDraft['aria-label'] || ''}
                        onChange={(e) => setAttributeDraft((prev) => ({ ...prev, 'aria-label': e.target.value }))}
                        className="h-8 text-xs"
                        placeholder="aria-label"
                      />
                    </div>
                  </>
                )}
                {(isImage || imageTarget?.kind === 'img') && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground block">Image Alt</Label>
                    <Input
                      value={attributeDraft.alt || ''}
                      onChange={(e) => setAttributeDraft((prev) => ({ ...prev, alt: e.target.value }))}
                      className="h-8 text-xs"
                      placeholder="Describe the image"
                    />
                  </div>
                )}
                <Button size="sm" className="h-8 w-full text-xs" onClick={handleAttributeSave} disabled={!onUpdateAttributes}>
                  Save Attributes
                </Button>
              </PopoverContent>
            </Popover>

            <Separator orientation="vertical" className="h-6 mx-0.5 bg-white/[0.1]" />
          </>
        )}

        {/* Color picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2">
              <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: currentColor }} />
              <ChevronDown className="w-2.5 h-2.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 space-y-3" align="start">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Text Color</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={currentColor} onChange={e => updateStyle('color', e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
                <Input value={currentColor} onChange={e => updateStyle('color', e.target.value)} className="h-7 text-xs flex-1 font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Background</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={currentBgColor === 'transparent' ? '#ffffff' : currentBgColor} onChange={e => updateStyle('backgroundColor', e.target.value)} className="w-8 h-8 rounded border cursor-pointer" />
                <Input value={currentBgColor} onChange={e => updateStyle('backgroundColor', e.target.value)} className="h-7 text-xs flex-1 font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Quick Colors</Label>
              <div className="flex flex-wrap gap-1">
                {['#000000','#ffffff','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#6b7280'].map(c => (
                  <button key={c} onClick={() => updateStyle('color', c)} className="w-6 h-6 rounded-full border border-border hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Spacing */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2">
              <Maximize2 className="w-3 h-3" /><ChevronDown className="w-2.5 h-2.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 space-y-3" align="start">
            {(['padding', 'margin', 'borderRadius'] as const).map(prop => (
              <div key={prop}>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs text-muted-foreground capitalize">{prop.replace(/([A-Z])/g, ' $1')}</Label>
                  <span className="text-[10px] font-mono text-muted-foreground">{styles[prop] || '0'}</span>
                </div>
                <Slider value={[parseInt(styles[prop] || '0')]} min={0} max={prop === 'borderRadius' ? 50 : 80} step={2} onValueChange={([v]) => updateStyle(prop, `${v}px`)} />
              </div>
            ))}
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-6 mx-0.5 bg-white/[0.1]" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => void runCommand({ type: 'set-style', target, styles: { display: isHidden ? getDefaultDisplay(element.tagName) : 'none' } })}
          className="h-7 text-xs gap-1 px-2"
          title={isHidden ? 'Show element' : 'Hide element'}
        >
          {isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {isHidden ? 'Show' : 'Hide'}
        </Button>

        <Separator orientation="vertical" className="h-6 mx-0.5 bg-white/[0.1]" />

        {/* AI toggle */}
        {hasAI && (
          <Button
            variant={isAIOpen ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setIsAIOpen(v => !v)}
            className={cn(
              'h-7 gap-1 px-2 transition-all',
              isAIOpen
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10',
            )}
            title={isAIOpen ? 'Close AI panel' : 'AI Edit — describe changes for this element'}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold">AI</span>
          </Button>
        )}

        {/* Section/element reorder */}
        {(onMoveUp || onMoveDown) && (
          <>
            <Separator orientation="vertical" className="h-6 mx-0.5 bg-white/[0.1]" />
            {onMoveUp && (
              <Button variant="ghost" size="sm" onClick={() => void runCommand({ type: 'move', target, direction: 'up' })} className="h-7 w-7 p-0" title="Move Up">
                <MoveUp className="w-3.5 h-3.5" />
              </Button>
            )}
            {onMoveDown && (
              <Button variant="ghost" size="sm" onClick={() => void runCommand({ type: 'move', target, direction: 'down' })} className="h-7 w-7 p-0" title="Move Down">
                <MoveDown className="w-3.5 h-3.5" />
              </Button>
            )}
          </>
        )}

        <Separator orientation="vertical" className="h-6 mx-0.5 bg-white/[0.1]" />

        <Button variant="ghost" size="sm" onClick={() => void runCommand({ type: 'duplicate', target })} className="h-7 w-7 p-0" title="Duplicate"><Copy className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="sm" onClick={() => void runCommand({ type: 'delete', target })} className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Delete"><Trash2 className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 w-7 p-0" title="Deselect"><Undo2 className="w-3.5 h-3.5" /></Button>
      </div>

      {/* ── Inline AI panel (expands below the buttons row) ── */}
      {isAIOpen && (
        <InlineAIPanel
          element={element}
          onClose={() => setIsAIOpen(false)}
          onAIEditComplete={onAIEditComplete}
          onRequestAI={onRequestAI}
          systemType={systemType}
          systemsBuildContext={systemsBuildContext}
          businessId={businessId}
          projectId={projectId}
          industry={industry}
          templateName={templateName}
          activePagePath={activePagePath}
          getVFSFiles={getVFSFiles}
        />
      )}
    </div>
  );
};

// Minimal label helper
const Label: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <label className={className}>{children}</label>
);
