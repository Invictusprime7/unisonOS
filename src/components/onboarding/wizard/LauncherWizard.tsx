/**
 * LauncherWizard — the Unison System Launcher.
 *
 * Selection surface only. Four steps: industry, goals, visitor actions/pages,
 * and brand style.
 * gather answers; `runLaunchPipeline` owns every deterministic stage. This
 * component never touches the VFS or authors a page. The orchestrator owns
 * deterministic generation and any guarded AI enrichment while this surface
 * renders selections, the resolved design contract, and live pipeline state.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Loader2,
  Monitor,
  PanelsTopLeft,
  Smartphone,
  Sparkle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { deriveChatLaunchPlan, buildSyncedVisionBrief, projectUniversalCreationInput, type ChatLaunchPlan } from "@/services/launch/chatLaunchPlan";
import type { ChatWizardStep } from '@/services/launch/chatWizardStep';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BusinessLogoInput } from "@/components/business/BusinessLogoInput";
import { cn } from "@/lib/utils";
import {
  THEME_PRESETS,
  type ThemePreset,
} from "@/components/onboarding/themePresets";
import { StyleTokenCard } from "@/components/onboarding/StyleTokenCard";
import {
  type ArtDirectionPackId,
} from "@/sections/variants/artDirectionPacks";
import {
  getWizardSectionPickers,
  getWizardVisualDirections,
} from "@/services/wizardDesignAvailability";
import {
  createWizardDesignSelection,
  type WizardExperiencePreference,
} from "@/services/wizardDesignSelection";
import type { VariantId } from "@/sections/variants/types";
import { clearLaunchInterviewDraft, readLaunchInterviewDraft, saveLaunchInterviewDraft } from '@/services/launch/interviewDraftService';


import { ImportProjectZipButton } from "@/components/onboarding/ImportProjectZipButton";
import { ImportUnisonSiteZipButton } from "@/components/onboarding/ImportUnisonSiteZipButton";
import type { BusinessSystemType } from "@/data/templates/types";

import { useLaunch } from "@/contexts/useLaunchHooks";
import {
  runLaunchPipeline,
  type LaunchOrchestratorInput,
} from "@/services/launch/launchOrchestrator";
import type { AppBuildGenerationMode } from '@/services/app-builder/appBuilderContracts';
import {
  createLaunchFailureReport,
  persistLaunchFailureReport,
  type LaunchFailureReport,
  type LaunchRunSnapshot,
} from "@/services/launch/launchRun";
import { LaunchStageTimeline } from "./LaunchStageTimeline";
import { VFSPreview } from '@/components/VFSPreview';
import { getOwnerInterviewQuestions } from '@/platform/core/ownerInterviewRegistry';

import {
  classifyPromptForWizard,
} from "./wizardPromptClassifier";
import {
  getIndustryCustomerNeeds,
  getIndustryDefaultPageChoices,
  getIndustryPageChoiceCards,
  getIndustryPrimaryGoal,
  CUSTOMER_NEEDS,
  INDUSTRY_FOCUS_CARDS,
  PRIMARY_GOALS,
  STEP_META,
  type CustomerNeed,
  type PageChoice,
  type PrimaryGoal,
  type WizardStep,
} from "./wizardCatalog";

export interface LauncherWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialVisionPrompt?: string | null;
  onLaunchComplete?: () => void;
  presentation?: "dialog" | "chat";
  /** True when this run is the account's one free Live Demo generation. */
  demoGeneration?: boolean;
  /** Account scope shared by Home Chat, Onboarding, and Builder launch surfaces. */
  draftScope?: string;
  guidedStep?: ChatWizardStep;
  guidancePending?: boolean;
  onSelectionConfirmed?: (answer: string) => void;
  prefill?: {
    businessId: string;
    businessName: string | null;
    industry: string | null;
    notificationEmail: string | null;
    email?: string | null;
    phone?: string | null;
    notificationPhone?: string | null;
    socialLinks?: Record<string, string> | null;
    tagline?: string | null;
    description?: string | null;
    website?: string | null;
    logoUrl?: string | null;
    brandColor?: string | null;
    timezone?: string | null;
    address?: NonNullable<LaunchOrchestratorInput['businessParameters']>['address'] | null;
    hours?: NonNullable<LaunchOrchestratorInput['businessParameters']>['hours'] | null;
  } | null;
}

const STEP_ORDER: WizardStep[] = [
  "industry",
  "goals",
  "questions",
  "aesthetic",
];

type SelectionStep = WizardStep | "pages" | "brand" | "confirm";
const CHAT_STEP_ORDER: SelectionStep[] = ["industry", "goals", "questions", "pages", "aesthetic", "brand", "confirm"];
const PROMPT_FIRST_STEP_ORDER: SelectionStep[] = ["industry", "goals", "questions", "pages", "aesthetic", "brand", "confirm"];
/** The no-AI starter is offered only when the AI provider itself could not run (outage, timeout, quota, credits). */
const AI_UNAVAILABLE_PATTERN = /timed? ?out|timeout|quota|credit|rate.?limit|429|402|unavailable|provider|no managed ai|not configured/i;
const CHAT_GUIDANCE: Record<SelectionStep, string> = {
  industry: "First, choose the business type that fits your idea. I'll suggest a starting point you can refine.",
  goals: "Let's choose the main outcome for your site. What matters most to your business?",
  questions: "Now let's shape what visitors can do. Keep the suggested actions or select the ones you need.",
  pages: "Which pages will support your goal? Home is always included; the rest are up to you.",
  aesthetic: "Let's give your site a visual personality. Choose a style, then fine-tune the art direction and experience.",
  brand: "What should we call your brand? You can also add social profiles before we wrap up.",
  confirm: "Here's the plan we've shaped together. Review your choices, go back to refine them, or create your site when you're ready.",
};
const PROMPT_FIRST_CHAT_GUIDANCE: Record<SelectionStep, string> = {
  industry: "Is there an industry or audience you'd like to emphasize beyond what's in your prompt?",
  goals: "What should visitors accomplish, if your prompt doesn't already make that clear?",
  questions: "Are there any important interactions missing from your description?",
  pages: "Would you like any additional pages beyond the ones you described?",
  aesthetic: "Do you have any visual preferences to add?",
  brand: "What name should appear on the application?",
  confirm: "Does this capture what you want to build?",
};

export const LauncherWizard = ({
  open,
  onOpenChange,
  onLaunchComplete,
  initialVisionPrompt,
  prefill,
  presentation = "dialog",
  demoGeneration = false,
  draftScope = 'anonymous',
  guidedStep,
  guidancePending = false,
  onSelectionConfirmed,
}: LauncherWizardProps) => {
  const navigate = useNavigate();
  const { setLaunch } = useLaunch();

  const isChat = presentation === "chat";
  const promptFirstBrief = isChat && Boolean(initialVisionPrompt?.trim());
  const [step, setStep] = useState<SelectionStep>(() =>
    promptFirstBrief ? "industry" : initialVisionPrompt?.trim() ? "brand" : "industry",
  );
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [completedTurns, setCompletedTurns] = useState<{ step: SelectionStep; answer: string }[]>([]);
  const currentTurnRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!isChat || !open) return;
    const turn = currentTurnRef.current;
    const viewport = turn?.closest<HTMLElement>('[data-chat-viewport]');
    if (turn && viewport) {
      viewport.scrollTo?.({
        top: viewport.scrollTop + turn.getBoundingClientRect().top - viewport.getBoundingClientRect().top - 12,
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
      turn.focus({ preventScroll: true });
    }
  }, [isChat, open, step]);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const industryChoiceTouchedRef = useRef(false);
  const promptFirst = promptFirstBrief && !industryChoiceTouchedRef.current;
  const stepOrder: readonly SelectionStep[] = promptFirst
    ? PROMPT_FIRST_STEP_ORDER
    : isChat ? CHAT_STEP_ORDER : STEP_ORDER;
  const chatGuidance = promptFirst ? PROMPT_FIRST_CHAT_GUIDANCE : CHAT_GUIDANCE;
  const [systemId, setSystemId] = useState<BusinessSystemType | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessParameters, setBusinessParameters] = useState<NonNullable<LaunchOrchestratorInput['businessParameters']>>({
    ownerEmail: prefill?.notificationEmail || '',
    notificationEmail: prefill?.notificationEmail || '',
    publicEmail: prefill?.email || '',
    phone: prefill?.phone || '',
    notificationPhone: prefill?.notificationPhone || '',
    tagline: prefill?.tagline || '',
    description: prefill?.description || '',
    website: prefill?.website || '',
    logoUrl: prefill?.logoUrl || '',
    brandColor: prefill?.brandColor || '',
    timezone: prefill?.timezone || '',
    address: prefill?.address || {},
    hours: prefill?.hours || [],
  });
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal | null>(null);
  const [customerNeeds, setCustomerNeeds] = useState<CustomerNeed[]>([]);
  const [selectedPages, setSelectedPages] = useState<PageChoice[]>([]);
  const [theme, setTheme] = useState<ThemePreset | null>(
    THEME_PRESETS[0] ?? null,
  );
  const [artDirectionPackId, setArtDirectionPackId] = useState<ArtDirectionPackId | null>(null);
  const [experience, setExperience] = useState<WizardExperiencePreference>("standard");
  const [sectionPins, setSectionPins] = useState<Record<string, VariantId>>({});

  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(prefill?.socialLinks ?? {});
  const [visionPrompt, setVisionPrompt] = useState("");
  const chatPlanRef = useRef<ChatLaunchPlan | null>(null);
  const pageChoicesTouchedRef = useRef(false);
  const isOpenEnded = selectedIndustry === 'universal' || chatPlanRef.current?.creationInput.mode === 'open-ended';
  const seededFromChatRef = useRef(false);

  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStatus, setLaunchStatus] = useState("");
  const [launchActivity, setLaunchActivity] = useState<string[]>([]);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchFailure, setLaunchFailure] =
    useState<LaunchFailureReport | null>(null);
  const [lastGenerationMode, setLastGenerationMode] = useState<AppBuildGenerationMode>('ai');
  const [progress, setProgress] = useState<LaunchRunSnapshot | null>(null);
  const latestProgressRef = useRef<LaunchRunSnapshot | null>(null);
  const [review, setReview] = useState<{ files: Record<string, string>; entryPoint: string } | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewReady, setPreviewReady] = useState(false);
  const reviewDecision = useRef<((accept: boolean) => void) | null>(null);
  const generationRef = useRef(0);
  const handlePreviewReady = useCallback(() => { setPreviewReady(true); setLaunchError(null); }, []);
  const handlePreviewError = useCallback((message: string) => { setPreviewReady(false); setLaunchError(`Preview could not render: ${message}`); }, []);
  // Unmount must not bump the launch generation: effect cleanups also run on
  // hot reload / StrictMode re-runs while state survives, and a bumped
  // generation silently orphaned the running launch (preview never opened).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!open) {
      setDraftHydrated(false);
      return;
    }
    setDraftHydrated(false);
    const draft = readLaunchInterviewDraft(draftScope);
    if (initialVisionPrompt) clearLaunchInterviewDraft(draftScope);
    if (draft) {
      if (initialVisionPrompt) {
        setBusinessName((current) => draft.selections.businessName || current);
        setSocialLinks((current) => ({ ...draft.selections.socialLinks, ...current }));
      } else {
        setSelectedIndustry(draft.selections.industry);
        setSystemId(draft.selections.systemId);
        setBusinessName(draft.selections.businessName);
        setPrimaryGoal(draft.selections.primaryGoal);
        setCustomerNeeds(draft.selections.customerNeeds);
        setSelectedPages(draft.selections.selectedPages);
        setTheme(THEME_PRESETS.find((preset) => preset.id === draft.selections.themePresetId) ?? THEME_PRESETS[0] ?? null);
        setExperience(draft.selections.experience);
        setSectionPins(draft.selections.sectionPins as Record<string, VariantId>);
        setSocialLinks(draft.selections.socialLinks);
        seededFromChatRef.current = true;
      }
      setBusinessParameters((current) => ({ ...current, ...draft.publicAnswers, ...draft.privateAnswers }));
    }
    setDraftHydrated(true);
  }, [open, draftScope]);

  const reset = useCallback(() => {
    generationRef.current++;
    reviewDecision.current?.(false);
    reviewDecision.current = null;
    setReview(null);
    setPreviewReady(false);
    setStep("industry");
    setCompletedTurns([]);
    seededFromChatRef.current = false;
    chatPlanRef.current = null;
    pageChoicesTouchedRef.current = false;
    industryChoiceTouchedRef.current = false;
    chatPlanRef.current = null;
    setSelectedIndustry(null);
    setSystemId(null);
    setBusinessName("");
    setBusinessParameters({});
    setPrimaryGoal(null);
    setCustomerNeeds([]);
    setSelectedPages([]);
    setTheme(THEME_PRESETS[0] ?? null);
    setArtDirectionPackId(null);
    setExperience("standard");
    setSectionPins({});

    setSocialLinks({});
    setVisionPrompt("");
    setIsLaunching(false);
    setLaunchStatus("");
    setLaunchError(null);
    setLaunchFailure(null);
    setLastGenerationMode('ai');
    setProgress(null);
    latestProgressRef.current = null;
    setProgress({ stages: [], activeStage: null, degradations: [], fatal: null, cancelled: false });
    setLaunchActivity([]);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (prefill?.businessName) setBusinessName(prefill.businessName);
    setBusinessParameters((current) => ({
      ...current,
      ownerEmail: current.ownerEmail || prefill?.notificationEmail || '',
      notificationEmail: current.notificationEmail || prefill?.notificationEmail || '',
      publicEmail: current.publicEmail || prefill?.email || '',
      phone: current.phone || prefill?.phone || '',
      notificationPhone: current.notificationPhone || prefill?.notificationPhone || '',
      tagline: current.tagline || prefill?.tagline || '',
      description: current.description || prefill?.description || '',
      website: current.website || prefill?.website || '',
      logoUrl: current.logoUrl || prefill?.logoUrl || '',
      brandColor: current.brandColor || prefill?.brandColor || '',
      timezone: current.timezone || prefill?.timezone || '',
      address: Object.keys(current.address || {}).length ? current.address : prefill?.address || {},
      hours: current.hours?.length ? current.hours : prefill?.hours || [],
    }));
    if (prefill?.socialLinks) setSocialLinks((current) => ({ ...prefill.socialLinks, ...current }));
    if (!initialVisionPrompt) { chatPlanRef.current = null; return; }

    setVisionPrompt(initialVisionPrompt);
    // One synced plan: everything the chat settled prefills the Wizard.
    const plan = deriveChatLaunchPlan(initialVisionPrompt, { promptFirst });
    const creationPlan = promptFirst
      ? { ...plan, creationInput: { ...plan.creationInput, mode: 'open-ended' as const } }
      : plan;
    chatPlanRef.current = creationPlan;
    pageChoicesTouchedRef.current = false;
    if (promptFirst) {
      setSelectedIndustry('universal');
      setSystemId('content');
      setPrimaryGoal(null);
      setCustomerNeeds([]);
      setSelectedPages(plan.selectedPages);
      if (plan.businessName) setBusinessName(current => current || plan.businessName!);
      const matchedTheme = THEME_PRESETS.find((preset) => preset.id === plan.themePresetId);
      if (matchedTheme) setTheme(matchedTheme);
      if (!stepOrder.includes(step)) setStep('brand');
      seededFromChatRef.current = true;
      return;
    }
    // Keep the live brief current, but never replay defaults over choices
    // already made in this mounted conversation.
    if (seededFromChatRef.current) {
      if (plan.businessName) setBusinessName(current => current || plan.businessName!);
      if (plan.industry && plan.systemId) {
        setSelectedIndustry(current => current ?? plan.industry);
        setSystemId(current => current ?? plan.systemId);
        if (plan.primaryGoal) setPrimaryGoal(current => current ?? plan.primaryGoal);
      }
      return;
    }
    seededFromChatRef.current = true;
    if (plan.businessName) setBusinessName(plan.businessName);
    if (plan.selectedPages.length) setSelectedPages(plan.selectedPages);
    const matchedTheme = THEME_PRESETS.find((preset) => preset.id === plan.themePresetId);
    if (matchedTheme) setTheme(matchedTheme);
    if (!plan.industry || !plan.systemId) return;

    setSelectedIndustry(plan.industry);
    setSystemId(plan.systemId);
    if (plan.primaryGoal) setPrimaryGoal(plan.primaryGoal);
    setCustomerNeeds(plan.customerNeeds);
    if (!guidedStep) setStep("goals");
  }, [open, initialVisionPrompt, promptFirst, step, stepOrder, prefill?.businessName, prefill?.notificationEmail, prefill?.email, prefill?.phone, prefill?.notificationPhone, prefill?.socialLinks, prefill?.tagline, prefill?.description, prefill?.website, prefill?.logoUrl, prefill?.brandColor, prefill?.timezone, prefill?.address, prefill?.hours, guidedStep]);

  useEffect(() => {
    if (!open || !draftHydrated) return;
    const { ownerEmail, notificationEmail, notificationPhone, ...publicAnswers } = businessParameters;
    saveLaunchInterviewDraft(draftScope, {
      selections: {
        industry: selectedIndustry,
        systemId,
        businessName,
        primaryGoal,
        customerNeeds,
        selectedPages,
        themePresetId: theme?.id ?? null,
        experience,
        sectionPins,
        socialLinks,
      },
      publicAnswers,
      privateAnswers: { ownerEmail, notificationEmail, notificationPhone },
    });
  }, [open, draftHydrated, draftScope, selectedIndustry, systemId, businessName, primaryGoal, customerNeeds, selectedPages, theme, experience, sectionPins, socialLinks, businessParameters]);

  // After the user answers, the chat must move forward at least one step —
  // even when the AI re-asks the same question (e.g. after Back + correction).
  const minNextStepRef = useRef<SelectionStep | null>(null);
  useEffect(() => {
    if (!open || !guidedStep || isLaunching || review || guidancePending) return;
    const floor = minNextStepRef.current;
    let target = floor && stepOrder.indexOf(floor) > stepOrder.indexOf(guidedStep) ? floor : guidedStep;
    // Never jump past a step whose answer is still missing — the AI may
    // skip ahead after a Back + correction, leaving Create site disabled.
    if (target === "confirm" && stepOrder.includes("aesthetic") && !theme) target = "aesthetic";
    else if (target === "confirm" && stepOrder.includes("brand") && !businessName.trim()) target = "brand";
    minNextStepRef.current = null;
    setStep(target);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, guidedStep, guidancePending, isLaunching, review]);

  const selectIndustry = (industry: string, id: BusinessSystemType) => {
    industryChoiceTouchedRef.current = true;
    setSelectedIndustry(industry);
    setSystemId(id);
    setPrimaryGoal(getIndustryPrimaryGoal(industry));
    setCustomerNeeds(getIndustryCustomerNeeds(industry));
    setSelectedPages(getIndustryDefaultPageChoices(industry));
    pageChoicesTouchedRef.current = false;
    if (chatPlanRef.current) {
      chatPlanRef.current = {
        ...chatPlanRef.current,
        creationInput: { ...chatPlanRef.current.creationInput, mode: 'guided' },
      };
    }
  };

  const selectOpenEnded = () => {
    industryChoiceTouchedRef.current = false;
    setSelectedIndustry('universal');
    setSystemId('content');
    setPrimaryGoal(null);
    setCustomerNeeds([]);
    pageChoicesTouchedRef.current = false;
    const prompt = chatPlanRef.current?.brief || visionPrompt;
    if (prompt.trim()) {
      const plan = deriveChatLaunchPlan(prompt, { promptFirst: true });
      chatPlanRef.current = plan;
      setSelectedPages(plan.selectedPages);
    } else {
      chatPlanRef.current = null;
      setSelectedPages([]);
    }
  };

  const toggle = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value)
      ? list.filter((entry) => entry !== value)
      : [...list, value];

  const pageChoices = useMemo(
    () => getIndustryPageChoiceCards(selectedIndustry),
    [selectedIndustry],
  );

  // Design availability is a registry projection: directions and section
  // choices are derived from the certified registry, the coverage gate, the
  // selected pages and the experience preference — never hard-coded here.
  const visualDirections = useMemo(
    () => getWizardVisualDirections({ selectedPages, experience }),
    [selectedPages, experience],
  );
  const sectionPickers = useMemo(
    () => getWizardSectionPickers(artDirectionPackId, experience),
    [artDirectionPackId, experience],
  );

  // A direction or pin that stops being eligible after another change must not
  // survive silently into the launch brief.
  useEffect(() => {
    if (
      artDirectionPackId &&
      !visualDirections.some((option) => option.id === artDirectionPackId && option.available)
    ) {
      setArtDirectionPackId(null);
    }
  }, [artDirectionPackId, visualDirections]);

  useEffect(() => {
    setSectionPins((current) => {
      const allowed = new Set(
        sectionPickers.flatMap((picker) => picker.options.map((option) => option.variantId)),
      );
      const next = Object.fromEntries(
        Object.entries(current).filter(([, variantId]) => allowed.has(variantId)),
      );
      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [sectionPickers]);



  const canContinue =
    step === "industry"
      ? Boolean(isOpenEnded ? visionPrompt.trim() : systemId && selectedIndustry)
      : step === "goals"
        ? Boolean(isOpenEnded || primaryGoal)
        : step === "questions"
          ? Boolean(isOpenEnded || primaryGoal)
          : step === "aesthetic" && isChat
            ? Boolean(theme)
            : step === "pages"
              ? Boolean(isOpenEnded || primaryGoal)
              : Boolean(businessName.trim() && theme);

  const selectionSummary = (selectedStep: SelectionStep): string => {
    switch (selectedStep) {
      case "industry": return selectedIndustry === 'universal' ? 'Open-ended' : INDUSTRY_FOCUS_CARDS.find(card => card.industry === selectedIndustry)?.label ?? selectedIndustry ?? "";
      case "goals": return PRIMARY_GOALS.find(goal => goal.id === primaryGoal)?.label ?? "";
      case "questions": return CUSTOMER_NEEDS.filter(need => customerNeeds.includes(need.id)).map(need => need.label).join(", ") || "No additional visitor actions";
      case "pages": return ["Home", ...pageChoices.filter(page => selectedPages.includes(page.id)).map(page => page.label)].join(", ");
      case "aesthetic": return [theme?.label, visualDirections.find(direction => direction.id === artDirectionPackId)?.name ?? "Auto-matched art direction", experience].join(" · ");
      case "brand": return [
        businessName.trim(),
        businessParameters.ownerEmail && `Owner email ${businessParameters.ownerEmail}`,
        businessParameters.publicEmail && `Public email ${businessParameters.publicEmail}`,
        businessParameters.phone && `Phone ${businessParameters.phone}`,
        businessParameters.website && `Website ${businessParameters.website}`,
        Object.values(businessParameters.address || {}).filter(Boolean).join(', '),
      ].filter(Boolean).join(' · ');
      default: return "";
    }
  };

  const goBack = () => {
    const index = stepOrder.indexOf(step);
    if (index > 0) {
      setCompletedTurns(current => current.filter(turn => stepOrder.indexOf(turn.step) < index - 1));
      setStep(stepOrder[index - 1]);
    }
  };

  const goNext = () => {
    if (onSelectionConfirmed) {
      const answer = selectionSummary(step);
      const confirmed = [...completedTurns.filter(turn => turn.step !== step), { step, answer }];
      setCompletedTurns(confirmed);
      const labels: Record<SelectionStep, string> = {
        industry: 'Business type', goals: 'Main goal', questions: 'Visitor actions',
        pages: 'Pages', aesthetic: 'Visual direction', brand: 'Brand name', confirm: 'Review',
      };
      const nextIndex = stepOrder.indexOf(step) + 1;
      if (nextIndex > 0 && nextIndex < stepOrder.length) minNextStepRef.current = stepOrder[nextIndex];
      onSelectionConfirmed([
        `My selection: ${answer}`,
        `Business type: ${selectionSummary('industry')}`,
        'Choices confirmed so far:',
        ...confirmed.map(turn => `${labels[turn.step]}: ${turn.answer}`),
      ].join('\n'));
      return;
    }
    const index = stepOrder.indexOf(step);
    if (index < stepOrder.length - 1) {
      if (isChat) setCompletedTurns(current => [...current, { step, answer: selectionSummary(step) }]);
      setStep(stepOrder[index + 1]);
    }
  };

  const handleGenerate = async (generationMode: AppBuildGenerationMode = 'ai') => {
    if (isLaunching || !systemId || !theme) return;
    if (isOpenEnded && !visionPrompt.trim()) {
      setLaunchError('Describe the site you want to create.');
      return;
    }
    if (!businessName.trim()) {
      setLaunchError("Please enter your business name.");
      return;
    }
    setLastGenerationMode(generationMode);
    setIsLaunching(true);
    reviewDecision.current?.(false);
    reviewDecision.current = null;
    const generation = ++generationRef.current;
    setReview(null);
    setPreviewReady(false);
    setLaunchError(null);
    setLaunchFailure(null);
    latestProgressRef.current = null;
    setLaunchStatus(generationMode === 'deterministic' ? 'Building starter pages…' : 'Preparing your site…');

    const derivedPlan = chatPlanRef.current ?? (isOpenEnded ? deriveChatLaunchPlan(visionPrompt, { promptFirst: true }) : null);
    const creationPlan = derivedPlan && isOpenEnded && derivedPlan.creationInput.mode !== 'open-ended'
      ? { ...derivedPlan, creationInput: { ...derivedPlan.creationInput, mode: 'open-ended' as const, industryHint: undefined } }
      : derivedPlan;
    const input: LaunchOrchestratorInput = {
      generationMode,
      systemId,
      industry: selectedIndustry || undefined,
      visionPrompt: creationPlan
        ? buildSyncedVisionBrief(creationPlan, {
            industry: selectedIndustry,
            businessName,
            primaryGoal,
            selectedPages,
            themePresetId: theme?.id ?? null,
          })
        : visionPrompt,
      universalCreation: projectUniversalCreationInput(creationPlan, selectedPages, { promptFirst }),
      theme,
      designSelection: createWizardDesignSelection({
        mode: artDirectionPackId ? "guided" : "auto",
        artDirectionPackId: artDirectionPackId ?? undefined,
        experience,
        sectionPins,
      }),
      businessName,
      businessParameters: {
        ...businessParameters,
        ownerEmail: businessParameters.ownerEmail?.trim() || businessParameters.notificationEmail?.trim() || undefined,
        notificationEmail: businessParameters.notificationEmail?.trim() || businessParameters.ownerEmail?.trim() || undefined,
        publicEmail: businessParameters.publicEmail?.trim() || undefined,
        phone: businessParameters.phone?.trim() || undefined,
        notificationPhone: businessParameters.notificationPhone?.trim() || undefined,
        tagline: businessParameters.tagline?.trim() || undefined,
        description: businessParameters.description?.trim() || undefined,
        website: businessParameters.website?.trim() || undefined,
        logoUrl: businessParameters.logoUrl?.trim() || undefined,
        brandColor: businessParameters.brandColor?.trim() || undefined,
        timezone: businessParameters.timezone?.trim() || undefined,
        address: Object.fromEntries(Object.entries(businessParameters.address || {}).filter(([, value]) => value?.trim())) as typeof businessParameters.address,
        hours: businessParameters.hours?.filter((entry) => entry.closed || entry.open || entry.close),
        ctaDestinations: {
          ...businessParameters.ctaDestinations,
          call: businessParameters.phone?.trim() ? `tel:${businessParameters.phone.trim().replace(/[^\d+]/g, '')}` : undefined,
          email: businessParameters.publicEmail?.trim() ? `mailto:${businessParameters.publicEmail.trim()}` : undefined,
        },
        socialLinks,
      },
      primaryGoal,
      customerNeeds,
      selectedPages,
      socialLinks,
      existingBusinessId: prefill?.businessId ?? null,
      regenerationNonce: generation > 1 ? `take-${generation}` : null,
    };

    try {
      const callbacks = {
        onReview: candidate => new Promise<boolean>(resolve => {
          if (generation !== generationRef.current || !mountedRef.current) { resolve(false); return; }
          setReview(candidate);
          setIsLaunching(false);
          reviewDecision.current = resolve;
        }),
        onStatus: status => {
          if (generation !== generationRef.current || !mountedRef.current) return;
          setLaunchStatus(status);
          setLaunchActivity(current => current[current.length - 1] === status ? current : [...current, status].slice(-6));
        },
        onProgress: (snapshot) => {
          if (generation !== generationRef.current || !mountedRef.current) return;
          latestProgressRef.current = snapshot;
          setProgress(snapshot);
        },
      };
      const result = await runLaunchPipeline({ ...input, demoGeneration }, callbacks);
      if (generation !== generationRef.current) return;
      clearLaunchInterviewDraft(draftScope);
      onLaunchComplete?.();
      setLaunch(result.launchState);
      navigate("/web-builder", {
        replace: true,
        state: result.navigationState,
      });
      onOpenChange(false);
    } catch (error) {
      if (generation !== generationRef.current || (error instanceof Error && error.name === 'LaunchReviewCancelled')) return;
      setReview(null);
      reviewDecision.current = null;
      setPreviewReady(false);
      const report = createLaunchFailureReport(error, latestProgressRef.current);
      const reportText = JSON.stringify(report, null, 2);
      persistLaunchFailureReport(report);
      setLaunchFailure(report);
      setLaunchError(
        `[${report.code}] ${report.message} Your selections are preserved.${report.stage === 'app-build' && generationMode === 'ai' && AI_UNAVAILABLE_PATTERN.test(report.message) ? ' The AI is unavailable right now; Build without AI creates a clearly labeled starter.' : ' You can try again.'}`,
      );
      console.error('[LauncherWizard] Generate Site failed', report, error);
      toast.error(`Generate Site failed in ${report.stage}`, {
        id: "wizard-generate-site-failed",
        description: `${report.code}: ${report.message}`,
        duration: 30_000,
        action: {
          label: 'Copy details',
          onClick: () => void navigator.clipboard?.writeText(reportText),
        },
      });
    } finally {
      if (generation === generationRef.current) {
        setIsLaunching(false);
        setLaunchStatus("");
      }
    }
  };

  const currentStepIndex = stepOrder.indexOf(step);
  const content = (
    <>
        {isChat && <h2 className="affinity-wizard-title">Affinity Wizard</h2>}
        {isChat && !guidedStep && !review && !isLaunching && <div className="space-y-4 p-3" aria-live="polite">
          {completedTurns.map((turn, index) => <div key={index} className="space-y-2">
            <p className="rounded-lg bg-white/5 p-3 text-sm text-white/80">{chatGuidance[turn.step]}</p>
            <p className="ml-8 rounded-lg border border-cyan-300/20 bg-cyan-400/10 p-3 text-sm text-cyan-100">{turn.answer}</p>
          </div>)}
          <p ref={currentTurnRef} tabIndex={-1} key={step} className="animate-fade-in motion-reduce:animate-none rounded-lg bg-white/5 p-3 text-sm leading-6 text-cyan-100 focus-visible:outline-none">{chatGuidance[step]}</p>
        </div>}
        {!isChat && !review && (
          <header className="border-b border-border px-5 py-4 pr-14 sm:px-7 sm:pr-16">
            <div className="flex items-center justify-between gap-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">Affinity Wizard</h2>
                  <p className="truncate text-xs text-muted-foreground">{STEP_META[currentStepIndex]?.sublabel}</p>
                </div>
              </div>
              {!isLaunching && (
                <div className="flex items-center gap-2" aria-label="Website setup progress">
                  {STEP_META.map((meta, index) => (
                    <span
                      key={meta.key}
                      aria-current={index === currentStepIndex ? "step" : undefined}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        index === currentStepIndex ? "w-8 bg-primary" : index < currentStepIndex ? "w-4 bg-primary/45" : "w-4 bg-muted",
                      )}
                    />
                  ))}
                  <span className="ml-1 text-xs tabular-nums text-muted-foreground">{currentStepIndex + 1}/{stepOrder.length}</span>
                </div>
              )}
            </div>
          </header>
        )}

        {review ? (
          <section className="flex max-h-[94dvh] min-h-0 flex-col" data-testid="wizard-generated-review">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 pr-14 sm:px-7 sm:pr-16">
              <div>
                <h2 className="text-lg font-semibold">{previewReady ? 'Your site is ready to review' : 'Preparing your site preview'}</h2>
                <p className="text-xs text-muted-foreground">{previewReady ? 'Check the result before opening it in the builder.' : 'Your pages are generated. We’re checking that they render correctly.'}</p>
              </div>
              <div className="flex items-center gap-1 rounded-md border border-border bg-muted/40 p-1">
                <Button size="icon" variant={previewDevice === 'desktop' ? 'secondary' : 'ghost'} aria-label="Desktop preview" aria-pressed={previewDevice === 'desktop'} onClick={() => setPreviewDevice('desktop')} className="h-8 w-8"><Monitor /></Button>
                <Button size="icon" variant={previewDevice === 'mobile' ? 'secondary' : 'ghost'} aria-label="Mobile preview" aria-pressed={previewDevice === 'mobile'} onClick={() => setPreviewDevice('mobile')} className="h-8 w-8"><Smartphone /></Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-muted/30 p-3 sm:p-4">
              <div className="h-[64dvh] min-h-96 overflow-hidden rounded-md border border-border bg-background">
                <VFSPreview nodes={[]} files={review.files} activeFile={review.entryPoint} device={previewDevice} forceBackend="sandpack" autoStart={false} showToolbar={false} onReady={handlePreviewReady} onError={handlePreviewError} />
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div className="flex gap-2">
                <Button variant="ghost" disabled={isLaunching} onClick={() => { reviewDecision.current?.(false); reviewDecision.current = null; setReview(null); }}>Edit details</Button>
                <Button variant="outline" disabled={isLaunching} onClick={() => handleGenerate('ai')}>Try another</Button>
              </div>
              <Button disabled={isLaunching || !previewReady} onClick={() => { setIsLaunching(true); reviewDecision.current?.(true); reviewDecision.current = null; }}>
                {isLaunching ? <Loader2 className="animate-spin" /> : <Sparkle />}
                {isLaunching ? 'Opening…' : 'Open in builder'}
              </Button>
            </div>
            {launchError && <p role="alert" className="px-7 pb-4 text-sm text-destructive">{launchError}</p>}
          </section>
        ) : (
          <div className={isChat ? "" : "max-h-[calc(94dvh-65px)] overflow-y-auto"}>
            {isLaunching && progress ? (
              <div className="mx-auto flex min-h-[560px] max-w-xl items-center px-6 py-12">
                <LaunchStageTimeline snapshot={progress} statusText={launchStatus} activity={launchActivity} generationMode={lastGenerationMode} className="w-full" />
              </div>
            ) : (
              <fieldset disabled={isLaunching || guidancePending} aria-busy={isLaunching || guidancePending} className={cn("mx-auto min-w-0 max-w-4xl", isChat ? "px-3 pb-4 pt-2" : "px-5 py-7 sm:px-8 sm:py-10")}>
                <div key={step} className="animate-fade-in">
                  {step === "industry" && (
                    <div className="mx-auto max-w-3xl space-y-7">
                      {!isChat && <StepHeading title="Choose your business type" subtitle="This gives Unison the right starting point. You can fine-tune your site goals and pages next." />}
                      {visionPrompt && !(selectedIndustry === 'universal' && !isChat) && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                          <p className="text-xs font-medium text-primary">Your site direction</p>
                          <p className="mt-1 text-sm leading-6 text-foreground/80">{visionPrompt}</p>
                        </div>
                      )}
                      {selectedIndustry === 'universal' && !isChat && (
                        <label className="block space-y-2">
                          <span className="text-sm font-medium">Describe the site you want to create</span>
                          <Textarea
                            value={visionPrompt}
                            onChange={(event) => {
                              const prompt = event.target.value;
                              setVisionPrompt(prompt);
                              if (!prompt.trim()) {
                                chatPlanRef.current = null;
                                if (!pageChoicesTouchedRef.current) setSelectedPages([]);
                                return;
                              }
                              const derived = deriveChatLaunchPlan(prompt, { promptFirst: true });
                              chatPlanRef.current = derived;
                              if (!pageChoicesTouchedRef.current) setSelectedPages(derived.selectedPages);
                            }}
                            rows={5}
                            maxLength={12000}
                            placeholder="A Ghana football publication with news, match coverage, team stories, and Ghanaian colors."
                            className="resize-y"
                          />
                        </label>
                      )}
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <Button type="button" variant="outline" aria-pressed={selectedIndustry === 'universal'} onClick={selectOpenEnded} className={cn("h-auto min-h-20 justify-start whitespace-normal p-3 text-left", selectedIndustry === 'universal' && "border-primary bg-primary/5 ring-1 ring-primary")}>
                          <span className="text-lg">✦</span><span><span className="block text-sm font-medium">Open-ended</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">{chatPlanRef.current?.creationInput.sitePurpose ?? 'Describe the site in your own words'}</span></span>
                        </Button>
                        {INDUSTRY_FOCUS_CARDS.map((card) => (
                          <Button key={card.industry} type="button" variant="outline" aria-pressed={selectedIndustry === card.industry} onClick={() => selectIndustry(card.industry, card.systemId)} className={cn("h-auto min-h-20 justify-start whitespace-normal p-3 text-left", selectedIndustry === card.industry && "border-primary bg-primary/5 ring-1 ring-primary")}>
                            <span className="text-lg">{card.icon}</span><span><span className="block text-sm font-medium">{card.label}</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">{card.tagline}</span></span>
                          </Button>
                        ))}
                      </div>
                      <details className="group border-t border-border pt-4">
                        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">Import an existing project <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
                        <div className="mt-4 flex flex-wrap gap-2"><ImportProjectZipButton onImported={() => onOpenChange(false)} />{prefill?.businessId && <ImportUnisonSiteZipButton businessId={prefill.businessId} onImported={() => onOpenChange(false)} />}</div>
                      </details>
                    </div>
                  )}

                  {step === "goals" && (
                    <div className="mx-auto max-w-3xl space-y-8">
                      {!isChat && <StepHeading title="What should your site accomplish?" subtitle="Choose the main outcome. After you continue, you can fine-tune visitor actions and pages." />}
                      <section className="space-y-3">
                        <FieldLabel>Primary goal</FieldLabel>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {PRIMARY_GOALS.map((goal) => <ChoiceCard key={goal.id} active={primaryGoal === goal.id} onClick={() => setPrimaryGoal(goal.id)} icon={goal.icon} title={goal.label} description={goal.description} />)}
                        </div>
                      </section>
                    </div>
                  )}

                  {step === "questions" && (
                    <div className="mx-auto max-w-3xl animate-fade-in space-y-8">
                      {!isChat && <StepHeading title="Shape the visitor experience" subtitle="Choose what visitors can do and which pages will support your goal." />}
                      <section className="space-y-3">
                        <FieldLabel>Visitor actions</FieldLabel>
                        <div className="flex flex-wrap gap-2">{CUSTOMER_NEEDS.map((need) => <Chip key={need.id} active={customerNeeds.includes(need.id)} onClick={() => setCustomerNeeds((current) => toggle(current, need.id))}><span>{need.icon}</span>{need.label}</Chip>)}</div>
                      </section>
{!isChat &&                       <section className="space-y-3 border-t border-border pt-6">
                        <FieldLabel>Pages to include</FieldLabel>
                        <p className="text-xs text-muted-foreground">Home is included automatically. Select any additional pages you need.</p>
                        <div className="flex flex-wrap gap-2"><span className="inline-flex items-center rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"><Check className="mr-2 h-3.5 w-3.5" />Home</span>{pageChoices.map((page) => <Chip key={page.id} active={selectedPages.includes(page.id)} onClick={() => { pageChoicesTouchedRef.current = true; setSelectedPages((current) => toggle(current, page.id)); }}><span>{page.icon}</span>{page.label}</Chip>)}</div>
                      </section>}
                    </div>
                  )}

                  {step === "aesthetic" && (
                    <div className="space-y-7">
                      {!isChat && <StepHeading title="Choose the visual direction" subtitle="Preview each style as a real interface, then fine-tune only if you need to." />}
                      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
                        <div className="relative min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
                          <StyleTokenCard theme={theme} businessName={businessName} showTokenLedger={false} className="rounded-none border-0" />
                          <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 overflow-x-auto rounded-lg border border-border/70 bg-background/90 p-2 shadow-xl backdrop-blur-md">
                            {THEME_PRESETS.map((preset, index) => (
                              <Button key={preset.id} type="button" variant="ghost" onClick={() => setTheme(preset)} aria-label={`Select ${preset.label} style`} aria-pressed={theme?.id === preset.id} className={cn("h-auto min-w-24 flex-1 flex-col items-stretch gap-2 rounded-md p-2", theme?.id === preset.id && "bg-accent ring-1 ring-ring")}>
                                <span className="flex h-8 overflow-hidden rounded-sm border border-border" aria-hidden="true"><span className="flex-1" style={{ backgroundColor: preset.palette.bg }} /><span className="w-3" style={{ backgroundColor: preset.palette.accent }} /><span className="w-3" style={{ backgroundColor: preset.palette.accent2 ?? preset.palette.fg }} /></span>
                                <span className="truncate text-center text-[11px]">{preset.label}</span>
                              </Button>
                            ))}
                          </div>
                        </div>
                        <aside className="space-y-5">
                          {!isChat && <div><FieldLabel>Business name</FieldLabel><Input aria-label="Business name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Northside Studio" className="mt-2" /><OwnerBrandFields industry={selectedIndustry} primaryGoal={primaryGoal} parameters={businessParameters} update={(patch) => setBusinessParameters((current) => ({ ...current, ...patch }))} /></div>}
                          <div className="space-y-2"><FieldLabel>Selected style</FieldLabel><div><p className="text-base font-semibold">{theme?.label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{theme?.description}</p></div></div>
                          <div><FieldLabel>Experience</FieldLabel><div className="mt-2 grid gap-2">{([['standard','Standard'],['motion-rich','Motion rich'],['immersive','Immersive 3D']] as const).map(([value,label]) => <Chip key={value} active={experience === value} onClick={() => setExperience(value)}>{label}</Chip>)}</div></div>
                        </aside>
                      </div>
                      <details className="group rounded-lg border border-border bg-card px-4 py-3">
                        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">Fine-tune direction and sections <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary>
                        <div className="mt-5 grid gap-6 border-t border-border pt-5 sm:grid-cols-2">
                          <div><FieldLabel>Visual direction</FieldLabel><div className="mt-2 grid gap-2"><Chip active={artDirectionPackId === null} onClick={() => setArtDirectionPackId(null)}>Auto match</Chip>{visualDirections.map((option) => <Chip key={option.id} active={artDirectionPackId === option.id} disabled={!option.available} title={option.unavailableReason} onClick={() => option.available && setArtDirectionPackId(option.id)}><span className="text-left"><span className="block">{option.name}</span><span className="block text-xs font-normal text-muted-foreground">{option.available ? option.description : option.unavailableReason}</span></span></Chip>)}</div></div>
                          <div><FieldLabel>Section treatment</FieldLabel><div className="mt-2 grid gap-3">{sectionPickers.length === 0 ? <p className="text-xs text-muted-foreground">Automatic choices will follow the selected style.</p> : sectionPickers.map((picker) => <label key={picker.sectionType} className="grid gap-1 text-xs text-muted-foreground"><span className="capitalize">{picker.sectionType.replace(/-/g, ' ')}</span><select value={sectionPins[picker.sectionType] ?? ''} onChange={(event) => setSectionPins((current) => { const next = {...current}; if (!event.target.value) delete next[picker.sectionType]; else next[picker.sectionType] = event.target.value as VariantId; return next; })} className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Auto</option>{picker.options.map((option) => <option key={option.variantId} value={option.variantId}>{option.name}</option>)}</select></label>)}</div></div>
{!isChat && <div className="sm:col-span-2"><FieldLabel>Social profiles</FieldLabel><div className="mt-2 grid gap-2 sm:grid-cols-2">{(['instagram','facebook','linkedin','youtube'] as const).map((platform) => <Input key={platform} value={socialLinks[platform] || ''} onChange={(event) => setSocialLinks((current) => ({...current,[platform]:event.target.value}))} placeholder={`${platform[0].toUpperCase()}${platform.slice(1)} URL`} aria-label={`${platform} profile URL`} />)}</div></div>}
                        </div>
                      </details>
                    </div>
                  )}
                  {step === "pages" && <section className="space-y-3">
                    <FieldLabel>Pages to include</FieldLabel>
                    <div className="flex flex-wrap gap-2"><span className="inline-flex items-center rounded-md border border-border bg-muted px-3 py-2 text-sm"><Check className="mr-2 h-3.5 w-3.5" />Home</span>{pageChoices.map(page => <Chip key={page.id} active={selectedPages.includes(page.id)} onClick={() => { pageChoicesTouchedRef.current = true; setSelectedPages(current => toggle(current, page.id)); }}>{page.icon} {page.label}</Chip>)}</div>
                  </section>}
                  {step === "brand" && <section className="space-y-5">
                    <label className="block text-sm">Brand name<Input aria-label="Business name" value={businessName} onChange={event => setBusinessName(event.target.value)} placeholder="Northside Studio" className="mt-2" /></label>
                    <OwnerBrandFields industry={selectedIndustry} primaryGoal={primaryGoal} parameters={businessParameters} update={(patch) => setBusinessParameters((current) => ({ ...current, ...patch }))} />
                    <details><summary className="cursor-pointer text-sm">Add social profiles (optional)</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{(['instagram','facebook','linkedin','youtube'] as const).map(platform => <Input key={platform} value={socialLinks[platform] || ''} onChange={event => setSocialLinks(current => ({...current,[platform]:event.target.value}))} placeholder={`${platform} URL`} aria-label={`${platform} profile URL`} />)}</div></details>
                  </section>}
                  {step === "confirm" && <section aria-label="Your site plan" className="rounded-lg border border-cyan-300/20 bg-cyan-400/5 p-4">
                    <h2 className="mb-4 text-lg font-semibold">Ready to create {businessName}?</h2>
                    <dl className="space-y-3">{(promptFirst
                      ? [
                          ['Purpose', chatPlanRef.current?.creationInput.sitePurpose ?? 'Website purpose described by the visitor'],
                          ['Pages', chatPlanRef.current?.creationInput.pages.map(page => page.title).join(', ') || 'Home'],
                          ['Requested functionality', chatPlanRef.current?.creationInput.requestedCapabilities.join(', ') || 'No backend capabilities requested'],
                          ['Brand name', selectionSummary('brand')],
                        ]
                      : ([['Business type','industry'],['Main goal','goals'],['Visitor actions','questions'],['Pages','pages'],['Visual direction','aesthetic'],['Brand name','brand']] as const).map(([label, selectedStep]) => [label, selectionSummary(selectedStep)])
                    ).map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm">{value}</dd></div>)}</dl>
                  </section>}
                </div>

                {launchError && <div role="alert" className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{launchError}{launchFailure && <details className="mt-2"><summary className="cursor-pointer text-xs font-medium">Technical details</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[10px]">{JSON.stringify(launchFailure, null, 2)}</pre></details>}{launchFailure?.stage === 'app-build' && lastGenerationMode === 'ai' && AI_UNAVAILABLE_PATTERN.test(launchError) && <Button variant="outline" disabled={isLaunching} onClick={() => handleGenerate('deterministic')} className="mt-3"><PanelsTopLeft />Build without AI</Button>}</div>}

                <footer className="mt-8 flex items-center justify-between border-t border-border pt-5">
                  {step === "industry" ? <span /> : <Button variant="ghost" onClick={goBack}><ArrowLeft />Back</Button>}
                  {(isChat ? step === "confirm" : step === "aesthetic") ? <div className="flex flex-col gap-2 sm:flex-row">
                    <Button disabled={!canContinue || isLaunching} onClick={() => handleGenerate('ai')}>{isLaunching ? <Loader2 className="animate-spin" /> : <Sparkle />}{isLaunching ? 'Creating…' : 'Create site'}</Button>
                  </div> : <Button disabled={!canContinue || isLaunching} onClick={goNext}>Continue<ArrowRight /></Button>}
                </footer>
              </fieldset>
            )}
          </div>
        )}
    </>
  );
  if (isChat) return open ? <section aria-label="Guided site setup" className="dark rounded-xl border border-cyan-300/20 bg-[#101521] text-foreground">{content}</section> : null;
  return (
    <Dialog open={open} onOpenChange={next => {
      if (isLaunching) return;
      onOpenChange(next);
      if (!next) reset();
    }}>
      <DialogContent className="max-h-[94dvh] w-[calc(100%-1rem)] max-w-[1040px] gap-0 overflow-hidden rounded-lg border-border bg-background p-0 text-foreground shadow-2xl sm:w-[calc(100%-3rem)]">
        <DialogHeader className="sr-only"><DialogTitle>Affinity Wizard</DialogTitle></DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
};

function OwnerBrandFields({
  industry,
  primaryGoal,
  parameters,
  update,
}: {
  industry: string | null;
  primaryGoal: PrimaryGoal | null;
  parameters: NonNullable<LaunchOrchestratorInput['businessParameters']>;
  update: (patch: Partial<NonNullable<LaunchOrchestratorInput['businessParameters']>>) => void;
}) {
  const ownerQuestions = getOwnerInterviewQuestions(industry || '', primaryGoal);
  const hasOwnerQuestion = (fieldId: string) => ownerQuestions.some((question) => question.fieldId === fieldId);
  const ownerEmailQuestion = ownerQuestions.find((question) => question.fieldId === 'ownerEmail');
  const showAddress = hasOwnerQuestion('address');
  const showHours = hasOwnerQuestion('hours');
  const showNotificationPhone = hasOwnerQuestion('notificationPhone');
  const address = parameters.address || {};
  const hours = parameters.hours || [];
  const days = [
    ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'],
    ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday'],
  ] as const;
  const updateAddress = (key: keyof NonNullable<typeof parameters.address>, value: string) => {
    update({ address: { ...address, [key]: value } });
  };
  const updateDay = (day: string, patch: Partial<NonNullable<typeof parameters.hours>[number]>) => {
    const existing = hours.find((entry) => entry.day === day);
    const nextEntry = { day, ...existing, ...patch };
    const nextHours = hours.filter((entry) => entry.day !== day);
    if (nextEntry.closed || nextEntry.open || nextEntry.close) nextHours.push(nextEntry);
    update({ hours: nextHours });
  };

  return (
    <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
      <p className="text-xs font-semibold text-foreground">Public contact details</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {hasOwnerQuestion('publicEmail') && <label className="block text-sm">Public email<Input aria-label="Public email" type="email" value={parameters.publicEmail || ''} onChange={(event) => update({ publicEmail: event.target.value })} placeholder="hello@business.com" className="mt-1.5" /></label>}
        {hasOwnerQuestion('phone') && <label className="block text-sm">Business phone<Input aria-label="Business phone" type="tel" value={parameters.phone || ''} onChange={(event) => update({ phone: event.target.value })} placeholder="+1 555 0100" className="mt-1.5" /></label>}
        {hasOwnerQuestion('website') && <label className="block text-sm">Website<Input aria-label="Business website" type="url" value={parameters.website || ''} onChange={(event) => update({ website: event.target.value })} placeholder="https://business.com" className="mt-1.5" /></label>}
      </div>
      {ownerEmailQuestion && <div className="border-t border-border/60 pt-3">
        <p className="text-xs font-medium text-muted-foreground">Private owner notifications</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">Owner email<Input aria-label="Owner email" type="email" value={parameters.ownerEmail || ''} onChange={(event) => update({ ownerEmail: event.target.value, notificationEmail: event.target.value })} placeholder="owner@business.com" className="mt-1.5" /></label>
          {ownerEmailQuestion.requiredAt && <p className="self-end text-xs text-muted-foreground">Private destination; required before {ownerEmailQuestion.requiredAt}.</p>}
          {showNotificationPhone && <label className="block text-sm">Notification phone<Input aria-label="Notification phone" type="tel" value={parameters.notificationPhone || ''} onChange={(event) => update({ notificationPhone: event.target.value })} placeholder="Optional SMS number" className="mt-1.5" /></label>}
        </div>
      </div>}
      <details className="group border-t border-border/60 pt-3">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground group-open:text-foreground">More brand details</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">Tagline<Input aria-label="Business tagline" value={parameters.tagline || ''} onChange={(event) => update({ tagline: event.target.value })} placeholder="A short line about your business" className="mt-1.5" /></label>
          <label className="block text-sm">Brand color<Input aria-label="Business brand color" type="color" value={parameters.brandColor || '#111827'} onChange={(event) => update({ brandColor: event.target.value })} className="mt-1.5 h-9 p-1" /></label>
          <div className="sm:col-span-2"><p className="mb-1.5 text-sm">Logo</p><BusinessLogoInput value={parameters.logoUrl} onChange={(logoUrl) => update({ logoUrl: logoUrl || undefined })} compact /></div>
          <label className="block text-sm sm:col-span-2">About the business<Textarea aria-label="Business description" value={parameters.description || ''} onChange={(event) => update({ description: event.target.value })} rows={2} placeholder="What should visitors know?" className="mt-1.5" /></label>
        </div>
      </details>
      {(showAddress || showHours) && <details className="group border-t border-border/60 pt-3">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground group-open:text-foreground">{showAddress ? 'Location and business hours' : 'Business hours'}</summary>
        <div className="mt-3 space-y-4">
          {showAddress && <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">Street address<Input aria-label="Street address" value={address.line1 || ''} onChange={(event) => updateAddress('line1', event.target.value)} className="mt-1.5" /></label>
            <label className="block text-sm">City<Input aria-label="Business city" value={address.city || ''} onChange={(event) => updateAddress('city', event.target.value)} className="mt-1.5" /></label>
            <label className="block text-sm">State or region<Input aria-label="Business region" value={address.region || ''} onChange={(event) => updateAddress('region', event.target.value)} className="mt-1.5" /></label>
            <label className="block text-sm">Postal code<Input aria-label="Business postal code" value={address.postalCode || ''} onChange={(event) => updateAddress('postalCode', event.target.value)} className="mt-1.5" /></label>
            <label className="block text-sm">Country<Input aria-label="Business country" value={address.country || ''} onChange={(event) => updateAddress('country', event.target.value)} className="mt-1.5" /></label>
          </div>}
          {showHours && <>
            <p className="text-[11px] text-muted-foreground">Visitor-facing hours are separate from bookable appointment slots.</p>
            <div className="space-y-2">
              {days.map(([day, label]) => {
                const entry = hours.find((item) => item.day === day);
                return <div key={day} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                  <span className="text-xs">{label}</span>
                  <Input aria-label={`${label} opening time`} type="time" value={entry?.open || ''} disabled={entry?.closed} onChange={(event) => updateDay(day, { open: event.target.value, closed: false })} className="h-8 w-28" />
                  <Input aria-label={`${label} closing time`} type="time" value={entry?.close || ''} disabled={entry?.closed} onChange={(event) => updateDay(day, { close: event.target.value, closed: false })} className="h-8 w-28" />
                  <label className="flex items-center gap-1 text-[11px] text-muted-foreground"><input aria-label={`${label} closed`} type="checkbox" checked={entry?.closed || false} onChange={(event) => updateDay(day, { closed: event.target.checked, open: event.target.checked ? '' : entry?.open, close: event.target.checked ? '' : entry?.close })} />Closed</label>
                </div>;
              })}
            </div>
            <label className="block max-w-xs text-sm">Time zone<Input aria-label="Business time zone" value={parameters.timezone || ''} onChange={(event) => update({ timezone: event.target.value })} placeholder="America/New_York" className="mt-1.5" /></label>
          </>}
        </div>
      </details>}
    </div>
  );
}

const StepHeading = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="max-w-2xl">
    <h2 className="text-2xl font-semibold sm:text-3xl">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>
  </div>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-xs font-medium text-muted-foreground">{children}</div>
);

const ChoiceCard = ({ active, onClick, icon, title, description }: { active: boolean; onClick: () => void; icon: string; title: string; description: string }) => (
  <Button type="button" variant="outline" onClick={onClick} aria-pressed={active} className={cn("h-auto min-h-24 items-start justify-start whitespace-normal p-4 text-left", active && "border-primary bg-primary/5 ring-1 ring-primary")}>
    <span className="text-lg">{icon}</span><span><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs font-normal leading-5 text-muted-foreground">{description}</span></span>
  </Button>
);

const Chip = ({ active, onClick, children, disabled = false, title }: { active: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean; title?: string }) => (
  <Button type="button" variant="outline" onClick={onClick} disabled={disabled} title={title} aria-pressed={active} className={cn("h-auto min-h-10 whitespace-normal rounded-md px-3 py-2 text-sm", active && "border-primary bg-primary/10 text-primary ring-1 ring-primary/30")}>
    {children}
  </Button>
);

export default LauncherWizard;
