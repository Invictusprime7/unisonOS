import React, { useEffect, useMemo, useRef, useState } from "react";
import { AssetsSection } from "./playground/AssetsSection";
import { isProductInStock } from "@/types/creatorData";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SetupWizardPanel } from "./setup-wizard/SetupWizardPanel";
import { useSetupWizard, type SetupStepId } from "@/hooks/useSetupWizard";
import { PlaygroundApiProvider, usePlaygroundApi } from "@/hooks/usePlaygroundApi";
import type { UseCreatorPlaygroundReturn } from "@/hooks/useCreatorPlayground";
import type { BuilderPageType, FunnelRole, PageRegistry } from "@/types/pageRegistry";
import type {
  PlaygroundBinding,
  PlaygroundCalendar,
  PlaygroundControlPlaneModel,
  PlaygroundIntentDependency,
  PlaygroundIntentReadinessReport,
  PlaygroundPopup,
  PlaygroundSetupField,
  PlaygroundSetupSnapshot,
  PlaygroundState,
  PlaygroundValidation,
  WizardSelections,
} from "@/types/playground";
import { resolvePlaygroundControlPlane } from "@/services/playgroundControlPlaneResolver";
import {
  CANONICAL_COMPONENT_DEFINITIONS,
  createCanonicalComponentInstance,
} from "@/services/canonicalComponentRegistry";
import { LaunchTasksPanel } from "./playground/LaunchTasksPanel";
import { LiveRuntimePreview } from "./playground/LiveResourcePreview";
import type { LaunchTask } from "@/services/playground/launchReadiness";
import { getProductSurfaces, getServiceSurfaces, buildCatalogTopology, type CatalogSurface } from "@/services/catalogTopology";
import {
  AlertTriangle,
  ArrowRight,
  Blocks,
  Briefcase,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileText,
  FormInput,
  Gauge,
  GitBranch,
  GripVertical,
  Home,
  Info,
  Link2,
  Network,
  LayoutGrid,
  MessageSquare,
  Plus,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Layers,
  Package,
  Image as ImageIcon,
  Star,
  Trash2,
  Pencil,
  XCircle,
  Zap,
} from "lucide-react";

const PAGE_TYPE_OPTIONS: { value: BuilderPageType; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "landing", label: "Landing" },
  { value: "about", label: "About" },
  { value: "contact", label: "Contact" },
  { value: "shop", label: "Shop" },
  { value: "product", label: "Product" },
  { value: "checkout", label: "Checkout" },
  { value: "cart", label: "Cart" },
  { value: "thankyou", label: "Thank You" },
  { value: "booking", label: "Booking" },
  { value: "gallery", label: "Gallery" },
  { value: "blog", label: "Blog" },
  { value: "faq", label: "FAQ" },
  { value: "pricing", label: "Pricing" },
  { value: "legal", label: "Legal" },
  { value: "custom", label: "Custom" },
];

type Section =
  | "launch"
  | "overview"
  | "pages"
  | "funnels"
  | "intent_registry"
  | "readiness"
  | "forms"
  | "components"
  | "calendars"
  | "products"
  | "customization"
  | "popups"
  | "services"
  | "assets"
  | "media"
  | "business";

const NAV_ITEMS: { id: Section; label: string; icon: React.ElementType; highlight?: boolean; group?: string }[] = [
  { id: "launch", label: "Launch", icon: Rocket, highlight: true },
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "pages", label: "Pages", icon: FileText, group: "Build" },
  { id: "components", label: "Components", icon: Blocks },
  { id: "assets", label: "Assets", icon: Package },
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "intent_registry", label: "Operations", icon: Settings, group: "Manage" },
  { id: "readiness", label: "Readiness", icon: ShieldCheck },
  { id: "customization", label: "AI / Inspector", icon: Star },
];

const INTENT_LABELS: Record<string, string> = {
  "nav.goto_page": "Navigate",
  "funnel.goto_step": "Funnel Step",
  "form.open": "Open Form",
  "popup.open": "Open Popup",
  "calendar.open": "Open Calendar",
  "checkout.start": "Start Checkout",
  "product.view": "View Product",
  "external.open": "External Link",
};

const BOOKING_TYPE_LABELS: Record<string, string> = {
  appointment: "Appointment",
  consultation: "Consultation",
  class: "Class",
  reservation: "Reservation",
  general: "General",
};

const POPUP_TRIGGER_LABELS: Record<string, string> = {
  cta_click: "CTA Click",
  timer: "Timer",
  scroll: "Scroll",
  exit_intent: "Exit Intent",
  manual: "Manual",
};

const SETUP_STEP_IDS = new Set<SetupStepId>([
  "booking_calendar",
  "notifications",
  "payments",
  "database",
  "domain",
  "seo",
  "analytics",
]);

function PlaygroundLaunchReadinessCard({ fallbackReady, fallbackTotal, onNavigate }: { fallbackReady: number; fallbackTotal: number; onNavigate: (section: Section) => void }) {
  const api = usePlaygroundApi();
  const [summary, setSummary] = useState({ ready: fallbackReady, total: fallbackTotal, percent: fallbackTotal ? Math.round((fallbackReady / fallbackTotal) * 100) : 0 });
  const [tasks, setTasks] = useState<LaunchTask[]>([]);

  useEffect(() => {
    let alive = true;
    void Promise.all([api.getLaunchReadiness(), api.getLaunchTasks()]).then(([nextSummary, nextTasks]) => {
      if (!alive) return;
      setSummary(nextSummary);
      setTasks(nextTasks);
    });
    return () => { alive = false; };
  }, [api]);

  return (
    <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5 shadow-[0_14px_35px_rgba(0,0,0,0.2)]">
      <p className="text-[11px] font-semibold text-slate-200">Launch Readiness</p>
      <div className="mt-3 flex items-center gap-3">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(rgb(52 211 153) ${summary.percent * 3.6}deg, rgb(30 41 50) 0deg)` }}><div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0b1218] text-[11px] font-semibold text-slate-100">{summary.ready}/{summary.total}</div></div>
        <div><p className="text-[11px] font-medium text-slate-200">{summary.ready === summary.total && summary.total > 0 ? "Ready to launch" : "Almost there!"}</p><p className="mt-1 text-[9px] leading-relaxed text-slate-500">Complete a few more steps to launch.</p></div>
      </div>
      <ul className="mt-3 space-y-2 text-[9px]">
        {tasks.slice(0, 4).map((task) => <li key={task.id}><button type="button" onClick={() => task.target?.playgroundSection && onNavigate(task.target.playgroundSection as Section)} className="flex w-full items-center gap-2 text-left text-slate-400"><span className={cn("h-1.5 w-1.5 rounded-full", task.status === "ready" ? "bg-emerald-400" : "border border-slate-500")} /><span className="flex-1 truncate">{task.title}</span>{task.status === "ready" ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <span className="h-3.5 w-3.5 rounded-full border border-slate-500" />}</button></li>)}
      </ul>
      <Button variant="outline" size="sm" className="mt-3 h-8 w-full justify-between border-white/10 bg-white/[0.035] px-3 text-[10px] text-slate-200 hover:bg-white/[0.07]" onClick={() => onNavigate("readiness")}>View Checklist <ArrowRight className="h-3 w-3" /></Button>
    </div>
  );
}

interface CreatorPlaygroundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditPreview?: () => void;
  playground: UseCreatorPlaygroundReturn;
  onPageSelect?: (pageId: string) => void;
  onPageAdd?: (pageId: string, title: string, path: string, pageType: BuilderPageType) => void;
  onPageRemove?: (pageId: string, path: string) => void;
  onFunnelCreate?: (funnelId: string, stepPages: { pageId: string; title: string; path: string; role: FunnelRole }[]) => void;
  businessId?: string | null;
  siteId?: string | null;
  projectId?: string | null;
  industry?: string | null;
  systemType?: string | null;
  initialSection?: Section;
  initialBindingId?: string;
  initialSetupField?: PlaygroundSetupField;
  bindings?: Record<string, PlaygroundBinding>;
  calendars?: Record<string, PlaygroundCalendar>;
  popups?: Record<string, PlaygroundPopup>;
  vfsFiles?: Record<string, string>;
  setupSnapshot?: PlaygroundSetupSnapshot;
  wizardSelections?: WizardSelections | null;
  onPublishLongform?: React.ComponentProps<typeof AssetsSection>["onPublishLongform"];
}

function formatIntentPackLabel(wizardSelections?: WizardSelections | null): string | null {
  if (!wizardSelections) return null;
  const source = wizardSelections.industryOverlay !== "general"
    ? wizardSelections.industryOverlay
    : wizardSelections.businessModel;
  return `${source.split("_").map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join(" ")} Pack`;
}

function getReadinessBadgeClass(status?: PlaygroundBinding["previewStatus"]) {
  switch (status) {
    case "ready":
      return "border-emerald-500/30 text-emerald-400 bg-emerald-500/10";
    case "partial":
      return "border-amber-500/30 text-amber-400 bg-amber-500/10";
    case "blocked":
      return "border-red-500/30 text-red-400 bg-red-500/10";
    default:
      return "border-border/40 text-muted-foreground";
  }
}

/**
 * Derive { pageId → status } from the live page registry + readiness report.
 * Aggregates binding previewStatus by source page; blocked > preview > ready.
 */
function getPageTitle(registry: PageRegistry, pageId: string) {
  return registry.pages[pageId]?.title || pageId;
}

export function CreatorPlaygroundModal({
  open,
  onOpenChange,
  onEditPreview,
  playground,
  onPageSelect,
  onPageAdd,
  onPageRemove,
  onFunnelCreate,
  businessId = null,
  siteId = null,
  projectId = null,
  industry = null,
  systemType = null,
  initialSection,
  initialBindingId,
  initialSetupField,
  bindings = {},
  calendars = {},
  popups = {},
  vfsFiles = {},
  setupSnapshot,
  wizardSelections = null,
  onPublishLongform,
}: CreatorPlaygroundModalProps) {
  const [activeSection, setActiveSection] = useState<Section>(
    initialSection || "assets",
  );
  const [selectedBindingId, setSelectedBindingId] = useState<string | null>(initialBindingId || null);
  const [businessFocusField, setBusinessFocusField] = useState<PlaygroundSetupField | null>(initialSetupField || null);
  const setupWizard = useSetupWizard({ siteId, businessId, projectId, industry, systemType });

  const playgroundState: PlaygroundState = useMemo(() => ({
    creatorData: playground.creatorData,
    pageRegistry: playground.pageRegistry,
    bindings,
    calendars,
    popups,
  }), [bindings, calendars, playground.creatorData, playground.pageRegistry, popups]);

  const controlPlane = useMemo<PlaygroundControlPlaneModel>(() => {
    const stepMap = new Map<string, NonNullable<PlaygroundSetupSnapshot['setupSteps']>[number]>();
    for (const step of setupSnapshot?.setupSteps || []) {
      stepMap.set(step.id, step);
    }
    for (const step of setupWizard.steps) {
      const existing = stepMap.get(step.id);
      const shouldKeepExisting = existing?.status === 'completed' && step.status === 'pending';
      if (shouldKeepExisting) continue;
      stepMap.set(step.id, {
        id: step.id,
        status: step.status,
        config: { ...(existing?.config || {}), ...step.config },
      });
    }

    return resolvePlaygroundControlPlane({
      state: playgroundState,
      vfsFiles,
      setupSnapshot: {
        ...setupSnapshot,
        setupSteps: Array.from(stepMap.values()),
      },
    });
  }, [playgroundState, setupSnapshot, setupWizard.steps, vfsFiles]);

  const validations = controlPlane.validations;
  const validationSummary = controlPlane.validationSummary;
  const readinessReport = controlPlane.readinessReport;

  useEffect(() => {
    if (open && initialSection) setActiveSection(initialSection);
  }, [initialSection, open]);

  useEffect(() => {
    if (open && initialBindingId) {
      setSelectedBindingId(initialBindingId);
      setActiveSection("intent_registry");
    }
  }, [initialBindingId, open]);

  useEffect(() => {
    if (open && initialSetupField) {
      setBusinessFocusField(initialSetupField);
      setActiveSection("business");
    }
  }, [initialSetupField, open]);

  const handleResolveDependency = (dependency: PlaygroundIntentDependency) => {
    if (
      dependency.resolverSection === "launch" &&
      dependency.resolverStepId &&
      SETUP_STEP_IDS.has(dependency.resolverStepId as SetupStepId)
    ) {
      setupWizard.setActiveStep(dependency.resolverStepId as SetupStepId);
      setActiveSection("launch");
      return;
    }
    if (dependency.resolverSection === "business") {
      if (dependency.resolverField) setBusinessFocusField(dependency.resolverField);
      setActiveSection("business");
      return;
    }
    if (dependency.resolverSection) setActiveSection(dependency.resolverSection);
  };

  const openPlaygroundSection = (section: Section) => {
    setActiveSection(section);
  };

  return (
    <PlaygroundApiProvider
      businessId={businessId}
      projectId={projectId}
      siteId={siteId}
      industry={industry ?? wizardSelections?.industryOverlay ?? null}
      systemType={systemType}
      vfsFiles={vfsFiles}
      notificationEmail={setupSnapshot?.notificationEmail ?? null}
      customDomain={setupSnapshot?.customDomain ?? null}
      publishBlockers={controlPlane.overview.blockedLaunchTasks}
      pageRegistry={playground.pageRegistry}
    >
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[94vh] w-[96vw] max-w-[1540px] gap-0 overflow-hidden border border-white/10 bg-[#080d12] p-0 shadow-[0_30px_100px_rgba(0,0,0,0.72),0_0_50px_rgba(16,185,129,0.07)] [&>button]:right-4 [&>button]:top-4 [&>button]:z-20 [&>button]:rounded-lg [&>button]:border [&>button]:border-white/10 [&>button]:bg-white/5 [&>button]:p-2 [&>button]:text-slate-400 [&>button]:hover:text-white">
        <DialogHeader className="h-[76px] flex-shrink-0 border-b border-white/10 bg-[#091016] p-0 pr-16">
          <div className="flex h-full items-center">
            <div className="flex h-full w-[234px] shrink-0 items-center gap-3 border-r border-white/10 px-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/15 bg-emerald-400/10 shadow-[0_0_24px_rgba(52,211,153,0.12)]"><Zap className="h-5 w-5 text-emerald-300" /></div>
              <span className="text-base font-semibold tracking-[-0.03em] text-white">Unison</span>
            </div>
            <div className="flex min-w-[380px] items-center gap-4 px-7">
              <DialogTitle className="text-base font-semibold tracking-[-0.025em] text-white">Creator's Playground</DialogTitle>
              <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2 text-[11px] text-slate-300 xl:flex">
                <Briefcase className="h-3.5 w-3.5 text-indigo-300" />
                <span className="max-w-[130px] truncate">{playground.creatorData.businessInfo.businessName || "Active workspace"}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
              </div>
            </div>
            <div className="mx-auto hidden h-10 max-w-[420px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 text-slate-500 lg:flex">
              <Search className="h-4 w-4" />
              <span className="flex-1 text-xs">Search assets, pages, or anything...</span>
              <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-500">⌘ K</kbd>
            </div>
            <div className="ml-5 flex items-center gap-3">
              <div className="hidden rounded-xl border border-emerald-400/10 bg-emerald-400/[0.07] px-3 py-2 md:block">
                <div className="flex items-center gap-2 text-[11px] font-medium text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                  Live Preview Connected
                </div>
                <p className="mt-0.5 pl-4 text-[10px] text-slate-500">Edits sync in real time</p>
              </div>
              <div className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs text-slate-200">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-emerald-400 text-[9px] text-emerald-300">{setupWizard.completedCount}</span>
                <span>{setupWizard.completedCount}/{setupWizard.totalCount} Ready</span>
              </div>
              {playground.isDirty && <Badge variant="outline" className="hidden h-7 border-amber-500/30 bg-amber-500/10 px-2 text-[10px] text-amber-300 xl:inline-flex">Unsaved</Badge>}
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          <nav className="flex w-[234px] flex-shrink-0 flex-col overflow-hidden border-r border-white/10 bg-[#091016] px-3 py-4">
            <div className="flex-1 overflow-y-auto">
            {NAV_ITEMS.map(({ id, label, icon: Icon, highlight, group }) => (
              <React.Fragment key={id}>
              {group && <div className="px-3 pb-1 pt-5 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">{group}</div>}
              <button
                key={id}
                onClick={() => openPlaygroundSection(id)}
                className={cn(
                  "mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-all duration-150",
                  activeSection === id
                    ? "border border-emerald-400/10 bg-emerald-400/10 text-emerald-300 shadow-[inset_2px_0_0_rgba(52,211,153,0.8)]"
                    : highlight
                      ? "text-indigo-300/80 hover:bg-white/5 hover:text-indigo-200"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
                )}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                {label}
                {id === "launch" && setupWizard.completedCount < setupWizard.totalCount && (
                  <Badge variant="outline" className="ml-auto text-[8px] h-4 px-1 border-violet-500/40 text-violet-400 bg-violet-500/10">
                    {setupWizard.completedCount}/{setupWizard.totalCount}
                  </Badge>
                )}
                {id === "pages" && <Badge variant="outline" className="ml-auto text-[8px] h-4 px-1 border-border/40">{controlPlane.overview.totalPages}</Badge>}
                {id === "funnels" && <Badge variant="outline" className="ml-auto text-[8px] h-4 px-1 border-border/40">{controlPlane.overview.totalFunnels}</Badge>}
                
                {id === "components" && <Badge variant="outline" className="ml-auto text-[8px] h-4 px-1 border-border/40">{Object.keys(playground.creatorData.componentInstances).length}</Badge>}
                {id === "intent_registry" && controlPlane.intentRegistry.length > 0 && (
                  <Badge variant="outline" className="ml-auto text-[8px] h-4 px-1 border-border/40">{controlPlane.intentRegistry.length}</Badge>
                )}
                {id === "readiness" && readinessReport.summary.blocked > 0 && (
                  <Badge variant="outline" className="ml-auto text-[8px] h-4 px-1 border-red-500/40 text-red-400 bg-red-500/10">{readinessReport.summary.blocked}</Badge>
                )}
                {id === "readiness" && readinessReport.summary.blocked === 0 && readinessReport.summary.previewOnly > 0 && (
                  <Badge variant="outline" className="ml-auto text-[8px] h-4 px-1 border-amber-500/40 text-amber-400 bg-amber-500/10">{readinessReport.summary.previewOnly}</Badge>
                )}
              </button>
              </React.Fragment>
            ))}
            </div>
            <PlaygroundLaunchReadinessCard fallbackReady={setupWizard.completedCount} fallbackTotal={setupWizard.totalCount} onNavigate={setActiveSection} />
          </nav>

          <div className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_50%_-20%,rgba(24,79,82,0.12),transparent_42%)]">
            <ScrollArea className="flex-1">
              <div className={cn("p-6", (activeSection === "assets" || activeSection === "media" || activeSection === "pages" || activeSection === "components") && "p-0")}>
                {activeSection === "launch" && (
                  <>
                    <LaunchTasksPanel
                      businessId={businessId}
                      projectId={projectId}
                      siteId={siteId}
                      industry={industry || wizardSelections?.industryOverlay || null}
                      systemType={systemType}
                      vfsFiles={vfsFiles}
                      notificationEmail={setupSnapshot?.notificationEmail || null}
                      customDomain={setupSnapshot?.customDomain || null}
                      publishBlockers={controlPlane.overview.blockedLaunchTasks}
                      onOpenTask={(task) => task.target?.playgroundSection && setActiveSection(task.target.playgroundSection as Section)}
                    />
                    <SetupWizardPanel wizard={setupWizard} businessId={businessId} siteId={siteId} />
                  </>
                )}
                {activeSection === "overview" && (
                  <OverviewSection
                    playground={playground}
                    controlPlane={controlPlane}
                    wizardSelections={wizardSelections}
                    onNavigate={openPlaygroundSection}
                  />
                )}
                {activeSection === "pages" && <PagesSection playground={playground} controlPlane={controlPlane} onPageSelect={onPageSelect} onPageAdd={onPageAdd} onPageRemove={onPageRemove} />}
                {activeSection === "funnels" && <FunnelsSection playground={playground} controlPlane={controlPlane} onFunnelCreate={onFunnelCreate} />}
                {(activeSection === "assets" || activeSection === "media" || activeSection === "products" || activeSection === "services" || activeSection === "forms") && (
                  <AssetsSection key={activeSection} initialTab={activeSection === "media" ? "media" : "catalog"} businessId={businessId} projectId={projectId} industry={industry ?? wizardSelections?.industryOverlay ?? null} vfsFiles={vfsFiles} creatorData={playground.creatorData} formsSlot={<FormsSection playground={playground} />} onReveal={(mark, files) => {
                    const slug = (f: string) => (f.split("/").pop() ?? "").replace(/\.(t|j)sx?$/, "").replace(/Page$/, "").toLowerCase();
                    const names = files.map(slug);
                    const page = controlPlane.pages.find((pg) => names.includes((pg.path.replace(/^\//, "") || "home").toLowerCase()) || names.includes(pg.title.replace(/\s+/g, "").toLowerCase()));
                    if (page) onPageSelect?.(page.pageId);
                    onEditPreview?.();
                    onOpenChange(false);
                    setTimeout(() => document.querySelectorAll("iframe").forEach((f) => f.contentWindow?.postMessage({ type: "REVEAL_RESOURCE", mark }, "*")), 400);
                  }} onPublishLongform={onPublishLongform} onPlace={(prompt) => {
                    onOpenChange(false);
                    setTimeout(() => window.dispatchEvent(new CustomEvent("unison:builder-prompt", { detail: { prompt } })), 300);
                  }} />
                )}
                {activeSection === "customization" && <CustomizationSection playground={playground} />}
                {activeSection === "components" && (
                  <ComponentsSection
                    playground={playground}
                    calendars={calendars}
                    readinessReport={readinessReport}
                  />
                )}
                {activeSection === "calendars" && <CalendarsSection calendars={calendars} registry={playground.pageRegistry} />}
                {activeSection === "popups" && <PopupsSection popups={popups} registry={playground.pageRegistry} />}
                {activeSection === "intent_registry" && (
                  <BindingsSection
                    bindings={readinessReport.bindings}
                    registry={playground.pageRegistry}
                    readinessReport={readinessReport}
                    selectedBindingId={selectedBindingId}
                    onBindingSelect={setSelectedBindingId}
                    onResolveDependency={handleResolveDependency}
                  />
                )}
                {activeSection === "readiness" && (
                  <ReadinessSection
                    validations={validations}
                    summary={validationSummary}
                    readinessReport={readinessReport}
                    registry={playground.pageRegistry}
                    onInspectBinding={(bindingId) => {
                      setSelectedBindingId(bindingId);
                      openPlaygroundSection("intent_registry");
                    }}
                    onInspectComponent={() => {
                      openPlaygroundSection("components");
                    }}
                    onResolveDependency={handleResolveDependency}
                  />
                )}
                {activeSection === "business" && (
                  <BusinessSection
                    playground={playground}
                    setupSnapshot={setupSnapshot}
                    focusField={businessFocusField}
                    onFocusHandled={() => setBusinessFocusField(null)}
                  />
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </PlaygroundApiProvider>
  );
}

function OverviewSection({
  playground,
  controlPlane,
  wizardSelections,
  onNavigate,
}: {
  playground: UseCreatorPlaygroundReturn;
  controlPlane: PlaygroundControlPlaneModel;
  wizardSelections?: WizardSelections | null;
  onNavigate: (section: Section) => void;
}) {
  const activePackLabel = formatIntentPackLabel(wizardSelections);
  const pages = controlPlane.pages;
  const funnels = controlPlane.funnels;
  const products = Object.values(playground.creatorData.products);
  const forms = Object.values(playground.creatorData.forms);
  const components = Object.values(playground.creatorData.componentInstances);

  const cards = [
    { section: "intent_registry" as Section, label: "Total Intents", count: controlPlane.overview.totalIntents, icon: Link2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { section: "readiness" as Section, label: "Ready Pages", count: controlPlane.overview.publishReadyPages, icon: ShieldCheck, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { section: "readiness" as Section, label: "Blocked Pages", count: controlPlane.overview.blockedPages, icon: Eye, color: "text-amber-400", bg: "bg-amber-500/10" },
    { section: "launch" as Section, label: "Launch Tasks", count: controlPlane.overview.blockedLaunchTasks, icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">Site Overview</h2>
        <p className="text-xs text-muted-foreground mt-1">
          {playground.creatorData.businessInfo.businessName || "Your site"} is organized around structure, business behavior, and publish readiness.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(({ section, label, count, icon: Icon, color, bg }) => (
          <button key={`${section}-${label}`} onClick={() => onNavigate(section)} className="flex items-center gap-3 p-4 rounded-xl border border-border/30 bg-muted/20 hover:bg-muted/40 transition-all text-left">
            <div className={cn("p-2 rounded-lg", bg)}><Icon className={cn("h-5 w-5", color)} /></div>
            <div>
              <div className="text-2xl font-bold text-foreground">{count}</div>
              <div className="text-[11px] text-muted-foreground">{label}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.25fr_0.95fr]">
        <div className="rounded-xl border border-border/30 bg-muted/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Behavior Model</h3>
              <p className="text-[11px] text-muted-foreground mt-1">Intent Registry and Readiness are now the primary operating views.</p>
            </div>
            {activePackLabel && <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">{activePackLabel}</Badge>}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <QuickCountCard label="Pages" count={controlPlane.overview.totalPages} onClick={() => onNavigate("pages")} />
            <QuickCountCard label="Funnels" count={controlPlane.overview.totalFunnels} onClick={() => onNavigate("funnels")} />
            <QuickCountCard label="Forms" count={forms.length} onClick={() => onNavigate("forms")} />
            <QuickCountCard label="Components" count={components.length} onClick={() => onNavigate("components")} />
            <QuickCountCard label="Products" count={products.length} onClick={() => onNavigate("products")} />
          </div>
          <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-muted-foreground">
            Active registry: {controlPlane.intentRegistry.length} intent{controlPlane.intentRegistry.length === 1 ? "" : "s"} mapped into the canvas and business graph.
          </div>
        </div>

        <div className="rounded-xl border border-border/30 bg-muted/10 p-4">
          <h3 className="text-sm font-semibold text-foreground">Control Plane Snapshot</h3>
          <div className="mt-3 space-y-2 text-xs">
            <SummaryRow label="Pages" value={`${controlPlane.overview.publishReadyPages} publish-ready / ${controlPlane.overview.blockedPages} blocked`} />
            <SummaryRow label="Funnels" value={`${controlPlane.overview.totalFunnels - controlPlane.overview.blockedFunnels} healthy / ${controlPlane.overview.blockedFunnels} blocked`} />
            <SummaryRow label="Launch Tasks" value={`${controlPlane.launchTasks.filter((task) => task.category === "required_for_publish").length} required / ${controlPlane.launchTasks.length} total`} />
            <SummaryRow label="Structural Validation" value={`${controlPlane.validationSummary.errors} errors / ${controlPlane.validationSummary.warnings} warnings`} />
          </div>
          <Button variant="outline" size="sm" className="mt-4 h-8 text-xs" onClick={() => onNavigate("readiness")}>Open Readiness</Button>
        </div>
      </div>
    </div>
  );
}

function QuickCountCard({ label, count, onClick }: { label: string; count: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg border border-border/20 bg-background/30 px-3 py-2 text-left">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{count}</div>
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/20 bg-background/30 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}

function PagesSection({
  playground,
  controlPlane,
  onPageSelect,
  onPageAdd,
  onPageRemove,
}: {
  playground: UseCreatorPlaygroundReturn;
  controlPlane: PlaygroundControlPlaneModel;
  onPageSelect?: (pageId: string) => void;
  onPageAdd?: (pageId: string, title: string, path: string, pageType: BuilderPageType) => void;
  onPageRemove?: (pageId: string, path: string) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [newPath, setNewPath] = useState("");
  const [newType, setNewType] = useState<BuilderPageType>("custom");
  const pages = controlPlane.pages;

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    const path = newPath.trim() || `/${newTitle.toLowerCase().replace(/\s+/g, "-")}`;
    const page = playground.addPage(newTitle.trim(), path, newType);
    onPageAdd?.(page.pageId, page.title, page.path, page.pageType);
    onPageSelect?.(page.pageId);
    setNewTitle("");
    setNewPath("");
    setNewType("custom");
  };

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-end justify-between">
        <div><h2 className="text-2xl font-bold tracking-tight text-white">Pages</h2><p className="mt-1 text-xs text-slate-500">Every route rendered from the live site runtime.</p></div>
        <Badge variant="outline" className="border-white/10 bg-white/[0.03] text-[10px] text-slate-300">{pages.length} live routes</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard title="Preview Ready" value={`${pages.filter((page) => page.previewStatus === "ready").length}`} />
        <SummaryCard title="Publish Ready" value={`${pages.filter((page) => page.publishStatus === "ready").length}`} />
        <SummaryCard title="Blocked" value={`${pages.filter((page) => page.publishStatus === "blocked").length}`} />
        <SummaryCard title="In Funnels" value={`${pages.filter((page) => page.funnelIds.length > 0).length}`} />
      </div>

      <div className="flex gap-2 p-3 rounded-lg border border-border/30 bg-muted/10">
        <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Page title..." className="h-8 text-xs flex-1 bg-background/50" />
        <Input value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="/path (auto)" className="h-8 text-xs w-32 bg-background/50" />
        <Select value={newType} onValueChange={(value) => setNewType(value as BuilderPageType)}>
          <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{PAGE_TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={handleAdd} disabled={!newTitle.trim()} className="h-8 px-3"><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {pages.map((page) => (
          <article key={page.pageId} className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10171d] transition hover:-translate-y-0.5 hover:border-emerald-400/30 hover:shadow-[0_18px_45px_rgba(0,0,0,.28)]">
            <button type="button" className="block w-full text-left" onClick={() => onPageSelect?.(page.pageId)}>
              <LiveRuntimePreview kind="page" route={page.path} name={page.title} className="h-44 border-b border-white/[0.07]" />
            </button>
            <div className="p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-semibold text-white">{page.title}</h3>{page.isHome ? <Home className="h-3.5 w-3.5 shrink-0 text-amber-400" /> : null}</div><p className="mt-1 truncate font-mono text-[10px] text-slate-500">{page.path}</p></div>
                <div className="flex items-center gap-1 opacity-70 transition group-hover:opacity-100">
              <Button variant="ghost" size="icon" aria-label={page.showInNav ? "Hide page from navigation" : "Show page in navigation"} className="h-7 w-7 text-slate-400" onClick={(event) => { event.stopPropagation(); playground.updatePage(page.pageId, { showInNav: !page.showInNav }); }}>
                {page.showInNav ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
              </Button>
              {!page.isHome && <Button variant="ghost" size="icon" aria-label="Set as home page" className="h-7 w-7 text-slate-400" onClick={(event) => { event.stopPropagation(); playground.setHomePage(page.pageId); }}><Star className="h-3 w-3" /></Button>}
              <Button variant="ghost" size="icon" aria-label="Delete page" className="h-7 w-7 text-slate-500 hover:text-red-300" onClick={(event) => { event.stopPropagation(); playground.removePage(page.pageId); onPageRemove?.(page.pageId, page.path); }}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5"><Badge variant="outline" className="h-5 border-white/10 text-[9px] text-slate-400">{page.pageType}</Badge><Badge variant="outline" className={cn("h-5 text-[9px]", getReadinessBadgeClass(page.previewStatus))}>Preview {page.previewStatus}</Badge><Badge variant="outline" className="h-5 border-white/10 text-[9px] text-slate-400">{page.boundIntentCount} intents</Badge></div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function FunnelsSection({
  playground,
  controlPlane,
  onFunnelCreate,
}: {
  playground: UseCreatorPlaygroundReturn;
  controlPlane: PlaygroundControlPlaneModel;
  onFunnelCreate?: CreatorPlaygroundModalProps["onFunnelCreate"];
}) {
  const [newName, setNewName] = useState("");
  const [expandedFunnel, setExpandedFunnel] = useState<string | null>(null);
  const funnels = controlPlane.funnels;

  const handleAdd = () => {
    if (!newName.trim()) return;
    const funnel = playground.addFunnel(newName.trim(), []);
    onFunnelCreate?.(funnel.funnelId, []);
    setExpandedFunnel(funnel.funnelId);
    setNewName("");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Funnels</h2>
        <Badge variant="outline" className="text-[10px]">{funnels.length} funnels</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <SummaryCard title="Healthy" value={`${funnels.filter((funnel) => funnel.publishStatus === "ready").length}`} />
        <SummaryCard title="Blocked" value={`${funnels.filter((funnel) => funnel.publishStatus === "blocked").length}`} />
        <SummaryCard title="Booking" value={`${funnels.filter((funnel) => funnel.funnelType === "booking").length}`} />
        <SummaryCard title="Checkout" value={`${funnels.filter((funnel) => funnel.funnelType === "checkout").length}`} />
      </div>

      <div className="flex gap-2 p-3 rounded-lg border border-border/30 bg-muted/10">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Funnel name..." className="h-8 text-xs flex-1 bg-background/50" />
        <Button size="sm" onClick={handleAdd} disabled={!newName.trim()} className="h-8 px-3"><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
      </div>

      <div className="space-y-2">
        {funnels.map((funnel) => (
          <div key={funnel.funnelId} className="rounded-xl border border-border/30 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 bg-muted/20 cursor-pointer hover:bg-muted/30" onClick={() => setExpandedFunnel(expandedFunnel === funnel.funnelId ? null : funnel.funnelId)}>
              <GitBranch className="h-4 w-4 text-fuchsia-400 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{funnel.name}</span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">{funnel.funnelType}</Badge>
                  <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", getReadinessBadgeClass(funnel.publishStatus))}>Publish {funnel.publishStatus}</Badge>
                </div>
                {funnel.missingDependencies.length > 0 && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Needs attention: {funnel.missingDependencies.join(", ")}
                  </div>
                )}
              </div>
              <Badge variant="outline" className="text-[10px] h-5 px-2">{funnel.steps.length} steps</Badge>
              {expandedFunnel === funnel.funnelId ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(event) => { event.stopPropagation(); playground.removeFunnel(funnel.funnelId); }}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            {expandedFunnel === funnel.funnelId && (
              <div className="px-4 py-3 space-y-2 bg-background/30">
                {funnel.steps.length === 0 && <p className="text-[11px] text-muted-foreground">No funnel steps added yet.</p>}
                {funnel.steps.map((step, index) => (
                  <div key={step.stepId} className="flex items-center gap-2">
                    {index > 0 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />}
                    <div className="flex-1 rounded-lg bg-muted/30 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{step.role}</Badge>
                        <span className="truncate">{step.title}</span>
                        <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", getReadinessBadgeClass(step.previewStatus))}>Preview {step.previewStatus}</Badge>
                        <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", getReadinessBadgeClass(step.publishStatus))}>Publish {step.publishStatus}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="font-mono">{step.path}</span>
                        <span>{step.boundIntentCount} intent{step.boundIntentCount === 1 ? "" : "s"}</span>
                        <span>{step.routeState.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => playground.removeFunnelStep(funnel.funnelId, step.stepId)}>
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function toCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function CustomizationSection({ playground }: { playground: UseCreatorPlaygroundReturn }) {
  const info = playground.creatorData.businessInfo;
  const brand = info.brandProfile || {};
  const customValues = Object.entries(info.customValues || {});
  const [newCustomKey, setNewCustomKey] = useState("");
  const [newCustomValue, setNewCustomValue] = useState("");

  const updateBrand = (updates: Record<string, string>) => {
    playground.updateBusinessInfo({
      brandProfile: {
        ...brand,
        ...updates,
      },
    });
  };

  const upsertCustomValue = (key: string, value: string) => {
    const nextKey = key.trim();
    if (!nextKey) return;
    playground.updateBusinessInfo({
      customValues: {
        ...(info.customValues || {}),
        [nextKey]: value,
      },
    });
  };

  const removeCustomValue = (key: string) => {
    const next = { ...(info.customValues || {}) };
    delete next[key];
    playground.updateBusinessInfo({ customValues: next });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-foreground">Customization</h2>
        <p className="mt-1 text-xs text-muted-foreground">Brand-safe colors, fonts, and reusable custom values now live in the Playground instead of scattered setup flows.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-border/30 bg-muted/10 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Brand Profile</h3>
            <Badge variant="outline" className="text-[10px]">Global</Badge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Primary Color"><Input value={brand.primaryColor || ""} onChange={(e) => updateBrand({ primaryColor: e.target.value })} placeholder="#0f766e" className="h-9 text-sm" /></Field>
            <Field label="Secondary Color"><Input value={brand.secondaryColor || ""} onChange={(e) => updateBrand({ secondaryColor: e.target.value })} placeholder="#1d4ed8" className="h-9 text-sm" /></Field>
            <Field label="Accent Color"><Input value={brand.accentColor || ""} onChange={(e) => updateBrand({ accentColor: e.target.value })} placeholder="#f97316" className="h-9 text-sm" /></Field>
            <Field label="Surface Color"><Input value={brand.surfaceColor || ""} onChange={(e) => updateBrand({ surfaceColor: e.target.value })} placeholder="#f8fafc" className="h-9 text-sm" /></Field>
            <Field label="Heading Font"><Input value={brand.headingFont || ""} onChange={(e) => updateBrand({ headingFont: e.target.value })} placeholder="Space Grotesk" className="h-9 text-sm" /></Field>
            <Field label="Body Font"><Input value={brand.bodyFont || ""} onChange={(e) => updateBrand({ bodyFont: e.target.value })} placeholder="DM Sans" className="h-9 text-sm" /></Field>
            <Field label="Button Radius"><Input value={brand.buttonRadius || ""} onChange={(e) => updateBrand({ buttonRadius: e.target.value })} placeholder="16px" className="h-9 text-sm" /></Field>
          </div>
        </div>

        <div className="rounded-xl border border-border/30 bg-muted/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Custom Values</h3>
              <p className="mt-1 text-[11px] text-muted-foreground">Reusable tokens for URLs, copy, and business data.</p>
            </div>
            <Badge variant="outline" className="text-[10px]">{customValues.length}</Badge>
          </div>
          <div className="mt-3 space-y-2">
            {customValues.length === 0 && (
              <div className="rounded-lg border border-border/20 bg-background/30 px-3 py-2 text-[11px] text-muted-foreground">No custom values configured yet.</div>
            )}
            {customValues.map(([key, value]) => (
              <div key={key} className="rounded-lg border border-border/20 bg-background/30 p-3">
                <div className="flex items-center gap-2">
                  <Input value={key} readOnly className="h-8 text-xs font-mono" />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeCustomValue(key)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input value={value} onChange={(e) => upsertCustomValue(key, e.target.value)} className="mt-2 h-8 text-xs" placeholder="Value" />
              </div>
            ))}
            <div className="rounded-lg border border-dashed border-border/40 bg-background/20 p-3">
              <div className="grid gap-2 md:grid-cols-[0.9fr_1.1fr_auto]">
                <Input value={newCustomKey} onChange={(e) => setNewCustomKey(e.target.value)} placeholder="custom_values.booking_url" className="h-8 text-xs font-mono" />
                <Input value={newCustomValue} onChange={(e) => setNewCustomValue(e.target.value)} placeholder="https://example.com/book" className="h-8 text-xs" />
                <Button
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    if (!newCustomKey.trim()) return;
                    upsertCustomValue(newCustomKey, newCustomValue);
                    setNewCustomKey("");
                    setNewCustomValue("");
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ProductFilter = "all" | "active" | "draft" | "archived" | "featured" | "out_of_stock" | "low_stock";

function ProductsSection({ playground, vfsFiles, onNavigateToPage }: { playground: UseCreatorPlaygroundReturn; vfsFiles: Record<string, string>; onNavigateToPage?: (pageId: string) => void }) {
  const allProducts = useMemo(
    () => Object.values(playground.creatorData.products).sort((a, b) => a.sortOrder - b.sortOrder),
    [playground.creatorData.products],
  );
  const collections = useMemo(
    () => Object.values(playground.creatorData.collections).filter((c) => c.type === "products"),
    [playground.creatorData.collections],
  );
  const componentInstances = useMemo(
    () => Object.values(playground.creatorData.componentInstances),
    [playground.creatorData.componentInstances],
  );

  const [filter, setFilter] = useState<ProductFilter>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(allProducts[0]?.productId || null);

  const homePageId = playground.pageRegistry.homePageId
    || Object.values(playground.pageRegistry.pages).find((p) => p.isHome)?.pageId
    || Object.values(playground.pageRegistry.pages)[0]?.pageId
    || null;

  const insertOrphanFix = (product: typeof allProducts[number], source: "featured" | "all") => {
    if (!homePageId) return;
    const created = playground.addComponentInstance({
      componentType: "ProductGrid",
      componentSlug: "product-grid",
      label: source === "featured" ? "Featured Products" : "All Products",
      bindings: { source },
      props: { source, title: source === "featured" ? "Featured Products" : "All Products" },
      usedOnPages: [homePageId],
    });
    if (created && onNavigateToPage) onNavigateToPage(homePageId);
  };

  const stats = useMemo(() => {
    let active = 0, draft = 0, archived = 0, featured = 0, outOfStock = 0, lowStock = 0;
    for (const p of allProducts) {
      if (p.status === "draft") draft++;
      else if (p.status === "archived") archived++;
      else active++;
      if (p.featured) featured++;
      if (!isProductInStock(p)) outOfStock++;
      else if (p.trackInventory && (p.lowStockThreshold ?? 0) > 0 && (p.stockQuantity ?? 0) > 0 && (p.stockQuantity ?? 0) <= (p.lowStockThreshold ?? 0)) lowStock++;
    }
    return { total: allProducts.length, active, draft, archived, featured, outOfStock, lowStock };
  }, [allProducts]);

  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProducts.filter((p) => {
      if (filter === "active" && (p.status && p.status !== "active")) return false;
      if (filter === "draft" && p.status !== "draft") return false;
      if (filter === "archived" && p.status !== "archived") return false;
      if (filter === "featured" && !p.featured) return false;
      if (filter === "out_of_stock" && isProductInStock(p)) return false;
      if (filter === "low_stock") {
        const qty = p.stockQuantity ?? 0;
        const low = p.lowStockThreshold ?? 0;
        if (!p.trackInventory || low <= 0 || qty <= 0 || qty > low) return false;
      }
      if (q && !`${p.name} ${p.sku || ""} ${p.category || ""} ${(p.tags || []).join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allProducts, filter, search]);

  useEffect(() => {
    if (!selectedProductId || !playground.creatorData.products[selectedProductId]) {
      setSelectedProductId(allProducts[0]?.productId || null);
    }
  }, [playground.creatorData.products, allProducts, selectedProductId]);

  const selectedProduct = selectedProductId ? playground.creatorData.products[selectedProductId] : null;

  const selectedProductCollections = useMemo(() => {
    if (!selectedProduct) return [];
    return collections.filter((c) => c.itemIds.includes(selectedProduct.productId));
  }, [collections, selectedProduct]);

  const selectedProductSurfaces: CatalogSurface[] = useMemo(() => {
    if (!selectedProduct) return [];
    return getProductSurfaces(selectedProduct, playground.creatorData, playground.pageRegistry, vfsFiles);
  }, [selectedProduct, playground.creatorData, playground.pageRegistry, vfsFiles]);

  // Per-product surface counts for the list (orphan badge / topology chip).
  const productSurfaceCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of allProducts) {
      m.set(p.productId, getProductSurfaces(p, playground.creatorData, playground.pageRegistry, vfsFiles).length);
    }
    return m;
  }, [allProducts, playground.creatorData, playground.pageRegistry, vfsFiles]);

  const toggleProductInCollection = (collectionId: string) => {
    if (!selectedProduct) return;
    const col = playground.creatorData.collections[collectionId];
    if (!col) return;
    const has = col.itemIds.includes(selectedProduct.productId);
    const itemIds = has ? col.itemIds.filter((id) => id !== selectedProduct.productId) : [...col.itemIds, selectedProduct.productId];
    playground.updateCollection(collectionId, { itemIds });
  };

  const filterChips: { value: ProductFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: stats.total },
    { value: "active", label: "Active", count: stats.active },
    { value: "featured", label: "Featured", count: stats.featured },
    { value: "draft", label: "Draft", count: stats.draft },
    { value: "low_stock", label: "Low Stock", count: stats.lowStock },
    { value: "out_of_stock", label: "Out of Stock", count: stats.outOfStock },
    { value: "archived", label: "Archived", count: stats.archived },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-500" /> Catalog
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Live-bound to <code className="rounded bg-muted/40 px-1 py-px text-[10px]">@/unison/products</code> — edits flow into ProductGrid, ProductCard, and cart at runtime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border/30 bg-muted/10 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors",
                viewMode === "list" ? "bg-emerald-500/15 text-foreground" : "text-muted-foreground hover:bg-muted/20",
              )}
              title="List view"
            >
              <LayoutGrid className="h-3 w-3" /> List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("graph")}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors",
                viewMode === "graph" ? "bg-emerald-500/15 text-foreground" : "text-muted-foreground hover:bg-muted/20",
              )}
              title="Topology graph view"
            >
              <Network className="h-3 w-3" /> Graph
            </button>
          </div>
          <Button
            size="sm"
            className="h-8 px-3"
            onClick={() => {
              const created = playground.addProduct({
                name: "New Offer",
                description: "",
                price: 99,
                currency: "USD",
                status: "active",
                trackInventory: true,
                stockQuantity: 10,
                inventoryPolicy: "deny_when_out",
                ctaLabel: "Buy Now",
                checkoutLabel: "Complete Purchase",
                variants: [],
              });
              setSelectedProductId(created.productId);
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        {[
          { label: "Total", value: stats.total, tone: "text-foreground" },
          { label: "Active", value: stats.active, tone: "text-emerald-500" },
          { label: "Featured", value: stats.featured, tone: "text-amber-500" },
          { label: "Low Stock", value: stats.lowStock, tone: "text-orange-500" },
          { label: "Out of Stock", value: stats.outOfStock, tone: "text-rose-500" },
          { label: "Collections", value: collections.length, tone: "text-sky-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border/30 bg-muted/10 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className={cn("text-lg font-semibold leading-tight", s.tone)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter + search */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {filterChips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setFilter(chip.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                filter === chip.value
                  ? "border-emerald-500/40 bg-emerald-500/15 text-foreground"
                  : "border-border/30 bg-muted/10 text-muted-foreground hover:bg-muted/20",
              )}
            >
              {chip.label}
              <span className="ml-1 text-muted-foreground/70">{chip.count}</span>
            </button>
          ))}
        </div>
        <div className="relative md:w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, SKU, tag…"
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      {viewMode === "graph" ? (
        <CatalogGraph
          playground={playground}
          vfsFiles={vfsFiles}
          mode="products"
          onSelect={(productId) => { setSelectedProductId(productId); setViewMode("list"); }}
          onNavigateToPage={onNavigateToPage}
          selectedItemId={selectedProductId}
        />
      ) : (
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2">
          {products.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/30 bg-muted/5 px-3 py-6 text-center text-xs text-muted-foreground">
              {allProducts.length === 0 ? "No products yet — add one to start binding." : "No products match this filter."}
            </div>
          )}
          {products.map((product) => {
            const inStock = isProductInStock(product);
            const tracked = product.trackInventory;
            const qty = product.stockQuantity ?? 0;
            const low = product.lowStockThreshold ?? 0;
            let label = inStock ? "In Stock" : "Out of Stock";
            if (inStock && tracked && low > 0 && qty > 0 && qty <= low) label = `Only ${qty} left`;
            else if (inStock && tracked) label = `${qty} in stock`;
            const productCollectionsCount = collections.filter((c) => c.itemIds.includes(product.productId)).length;
            const surfaceCount = productSurfaceCounts.get(product.productId) ?? 0;

            return (
              <button
                key={product.productId}
                type="button"
                onClick={() => setSelectedProductId(product.productId)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  selectedProductId === product.productId ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/30 bg-muted/10 hover:bg-muted/20",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/30 bg-muted/20 flex items-center justify-center">
                    {product.imageAssetId || (product.images && product.images.length > 0) ? (
                      <img
                        src={product.imageAssetId || (product.images?.[0] as { url?: string } | undefined)?.url || ""}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="truncate text-sm font-medium text-foreground">{product.name}</div>
                      {product.featured && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {product.currency} {product.price}{product.priceSuffix ? ` ${product.priceSuffix}` : ""}
                      {product.sku ? <span className="ml-2 font-mono opacity-70">{product.sku}</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] h-4 px-1.5",
                          !inStock && "border-rose-500/40 text-rose-500",
                          inStock && tracked && low > 0 && qty <= low && "border-orange-500/40 text-orange-500",
                        )}
                      >
                        {label}
                      </Badge>
                      {product.status && product.status !== "active" && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 capitalize">{product.status}</Badge>
                      )}
                      {product.billingType === "subscription" && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5">Subscription</Badge>
                      )}
                      {productCollectionsCount > 0 && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-sky-500/40 text-sky-500">
                          <Layers className="mr-0.5 h-2.5 w-2.5" />{productCollectionsCount}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] h-4 px-1.5",
                          surfaceCount === 0 ? "border-rose-500/40 text-rose-400" : "border-emerald-500/40 text-emerald-500",
                        )}
                        title={surfaceCount === 0 ? "Orphaned — not rendered on any page" : `Appears on ${surfaceCount} surface${surfaceCount === 1 ? "" : "s"}`}
                      >
                        <Link2 className="mr-0.5 h-2.5 w-2.5" />{surfaceCount}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      playground.removeProduct(product.productId);
                      if (selectedProductId === product.productId) setSelectedProductId(null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-border/30 bg-muted/10 p-4">
          {!selectedProduct ? (
            <p className="text-sm text-muted-foreground">Select a product to customize it.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Product Name"><Input value={selectedProduct.name} onChange={(e) => playground.updateProduct(selectedProduct.productId, { name: e.target.value })} className="h-9 text-sm" /></Field>
                <Field label="Slug"><Input value={selectedProduct.slug || ""} onChange={(e) => playground.updateProduct(selectedProduct.productId, { slug: e.target.value })} className="h-9 text-sm" /></Field>
                <Field label="SKU"><Input value={selectedProduct.sku || ""} onChange={(e) => playground.updateProduct(selectedProduct.productId, { sku: e.target.value })} className="h-9 text-sm" /></Field>
                <Field label="Category"><Input value={selectedProduct.category || ""} onChange={(e) => playground.updateProduct(selectedProduct.productId, { category: e.target.value })} className="h-9 text-sm" /></Field>
                <Field label="Price"><Input type="number" value={selectedProduct.price} onChange={(e) => playground.updateProduct(selectedProduct.productId, { price: Number(e.target.value || 0) })} className="h-9 text-sm" /></Field>
                <Field label="Compare At"><Input type="number" value={selectedProduct.compareAtPrice ?? ""} onChange={(e) => playground.updateProduct(selectedProduct.productId, { compareAtPrice: e.target.value ? Number(e.target.value) : undefined })} className="h-9 text-sm" /></Field>
                <Field label="Currency"><Input value={selectedProduct.currency} onChange={(e) => playground.updateProduct(selectedProduct.productId, { currency: e.target.value })} className="h-9 text-sm" /></Field>
                <Field label="Price Suffix"><Input value={selectedProduct.priceSuffix || ""} onChange={(e) => playground.updateProduct(selectedProduct.productId, { priceSuffix: e.target.value })} placeholder="/month" className="h-9 text-sm" /></Field>
                <Field label="CTA Label"><Input value={selectedProduct.ctaLabel || ""} onChange={(e) => playground.updateProduct(selectedProduct.productId, { ctaLabel: e.target.value })} placeholder="Buy Now" className="h-9 text-sm" /></Field>
                <Field label="Checkout Label"><Input value={selectedProduct.checkoutLabel || ""} onChange={(e) => playground.updateProduct(selectedProduct.productId, { checkoutLabel: e.target.value })} placeholder="Complete Purchase" className="h-9 text-sm" /></Field>
                <Field label="Visibility">
                  <Select value={selectedProduct.visibility || "public"} onValueChange={(value) => playground.updateProduct(selectedProduct.productId, { visibility: value as "public" | "hidden" | "featured" })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="featured">Featured Only</SelectItem>
                      <SelectItem value="hidden">Hidden</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Billing">
                  <Select value={selectedProduct.billingType || "one_time"} onValueChange={(value) => playground.updateProduct(selectedProduct.productId, { billingType: value as "one_time" | "subscription" })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_time">One Time</SelectItem>
                      <SelectItem value="subscription">Subscription</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field label="Image URL / Asset">
                <Input
                  value={selectedProduct.imageAssetId || ""}
                  onChange={(e) => playground.updateProduct(selectedProduct.productId, { imageAssetId: e.target.value || undefined })}
                  placeholder="https://… or asset_id"
                  className="h-9 text-sm"
                />
              </Field>

              <Field label="Description">
                <Textarea value={selectedProduct.description || ""} onChange={(e) => playground.updateProduct(selectedProduct.productId, { description: e.target.value })} className="min-h-[88px] text-sm" />
              </Field>

              <Field label="Tags">
                <Input value={(selectedProduct.tags || []).join(", ")} onChange={(e) => playground.updateProduct(selectedProduct.productId, { tags: toCommaList(e.target.value) })} placeholder="starter, featured, bestseller" className="h-9 text-sm" />
              </Field>

              <div className="rounded-lg border border-border/20 bg-background/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-foreground">Inventory & Status</div>
                  <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", isProductInStock(selectedProduct) ? "border-emerald-500/40 text-emerald-500" : "border-rose-500/40 text-rose-500")}>
                    {isProductInStock(selectedProduct) ? "Available" : "Unavailable"}
                  </Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Status">
                    <Select
                      value={selectedProduct.status || "active"}
                      onValueChange={(value) => playground.updateProduct(selectedProduct.productId, { status: value as "draft" | "active" | "archived" })}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Inventory Policy">
                    <Select
                      value={selectedProduct.inventoryPolicy || "deny_when_out"}
                      onValueChange={(value) => playground.updateProduct(selectedProduct.productId, { inventoryPolicy: value as "deny_when_out" | "allow_backorder" })}
                    >
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deny_when_out">Deny when out of stock</SelectItem>
                        <SelectItem value="allow_backorder">Allow backorder</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Stock Quantity">
                    <Input
                      type="number"
                      min={0}
                      value={selectedProduct.stockQuantity ?? ""}
                      onChange={(e) => playground.updateProduct(selectedProduct.productId, { stockQuantity: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })}
                      placeholder="Untracked"
                      disabled={!selectedProduct.trackInventory}
                      className="h-9 text-sm"
                    />
                  </Field>
                  <Field label="Low Stock Threshold">
                    <Input
                      type="number"
                      min={0}
                      value={selectedProduct.lowStockThreshold ?? ""}
                      onChange={(e) => playground.updateProduct(selectedProduct.productId, { lowStockThreshold: e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)) })}
                      placeholder="e.g. 3"
                      disabled={!selectedProduct.trackInventory}
                      className="h-9 text-sm"
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={selectedProduct.featured ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => playground.updateProduct(selectedProduct.productId, { featured: !selectedProduct.featured })}
                  >
                    <Star className={cn("mr-1 h-3 w-3", selectedProduct.featured && "fill-current")} />
                    {selectedProduct.featured ? "Featured" : "Mark Featured"}
                  </Button>
                  <Button
                    variant={selectedProduct.trackInventory ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => playground.updateProduct(selectedProduct.productId, { trackInventory: !selectedProduct.trackInventory })}
                  >
                    {selectedProduct.trackInventory ? "Tracking Inventory" : "Track Inventory"}
                  </Button>
                </div>
              </div>

              {/* Collections binding */}
              <div className="rounded-lg border border-border/20 bg-background/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Layers className="h-3.5 w-3.5 text-sky-500" /> Collections
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      playground.addCollection({ name: "New Collection", type: "products", itemIds: [selectedProduct.productId] });
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" /> New
                  </Button>
                </div>
                {collections.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground">No product collections yet.</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {collections.map((c) => {
                      const member = c.itemIds.includes(selectedProduct.productId);
                      return (
                        <div
                          key={c.collectionId}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 text-[11px] transition-colors",
                            member
                              ? "border-sky-500/40 bg-sky-500/15 text-foreground"
                              : "border-border/30 bg-muted/10 text-muted-foreground hover:bg-muted/20",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggleProductInCollection(c.collectionId)}
                            className="inline-flex items-center gap-1"
                            title={member ? "Remove from collection" : "Add to collection"}
                          >
                            {member ? "✓ " : "+ "}{c.name}
                            <span className="ml-0.5 opacity-60">{c.itemIds.length}</span>
                          </button>
                          <CollectionPillEditor
                            playground={playground}
                            collectionId={c.collectionId}
                            itemKind="products"
                            candidates={allProducts.map((p) => ({ id: p.productId, name: p.name, meta: `${p.currency} ${p.price}` }))}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Topology — where this product appears in the live preview */}
              <div className="rounded-lg border border-border/20 bg-background/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Link2 className="h-3.5 w-3.5 text-emerald-500" /> Appears on
                  </div>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                    {selectedProductSurfaces.length} surface{selectedProductSurfaces.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Real bindings + VFS scan: where this product is rendered in the preview canvas right now.
                </p>
                {selectedProductSurfaces.length === 0 ? (
                  <div className="rounded border border-dashed border-rose-500/30 bg-rose-500/5 px-2.5 py-2 text-[11px] text-rose-300 space-y-2">
                    <div>
                      <strong className="font-semibold">Orphaned</strong> — not rendered anywhere yet. Add a <code className="rounded bg-muted/40 px-1 text-[10px]">ProductGrid</code> on Home, or drop it into a collection above.
                    </div>
                    {homePageId && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedProduct.featured && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                            onClick={() => insertOrphanFix(selectedProduct, "featured")}
                          >
                            <Plus className="mr-1 h-3 w-3" /> Insert Featured Grid on Home
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] border-violet-500/40 text-violet-300 hover:bg-violet-500/10"
                          onClick={() => insertOrphanFix(selectedProduct, "all")}
                        >
                          <Plus className="mr-1 h-3 w-3" /> Insert All-Products Grid on Home
                        </Button>
                        {!selectedProduct.featured && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px]"
                            onClick={() => playground.updateProduct(selectedProduct.productId, { featured: true })}
                          >
                            <Star className="mr-1 h-3 w-3" /> Mark Featured
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {selectedProductSurfaces.map((surface) => (
                      <button
                        type="button"
                        key={surface.id}
                        disabled={!surface.pageId || !onNavigateToPage}
                        onClick={() => surface.pageId && onNavigateToPage?.(surface.pageId)}
                        className={cn(
                          "w-full text-left flex items-center justify-between gap-2 rounded-md border border-border/20 bg-muted/10 px-2.5 py-1.5 transition-colors",
                          surface.pageId && onNavigateToPage ? "hover:bg-muted/20 cursor-pointer" : "cursor-default opacity-90",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-foreground">
                            {surface.pageLabel}
                            {surface.pageSlug ? <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{surface.pageSlug}</span> : null}
                          </div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            <span className="font-mono">{surface.componentType}</span>
                            <span className="ml-1.5">·</span>
                            <span className="ml-1.5">{surface.kind === "vfs_static" ? "static jsx" : surface.kind}</span>
                            {surface.source ? <span className="ml-1.5">· source: <span className="font-mono">{surface.source}</span></span> : null}
                            {surface.collectionName ? <span className="ml-1.5">· collection: <span className="font-mono">{surface.collectionName}</span></span> : null}
                            {surface.filePath ? <span className="ml-1.5 opacity-70">· {surface.filePath.replace(/^\/src\//, "")}</span> : null}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] h-4 px-1.5",
                            surface.kind === "direct" && "border-emerald-500/40 text-emerald-400",
                            surface.kind === "featured" && "border-amber-500/40 text-amber-400",
                            surface.kind === "collection" && "border-sky-500/40 text-sky-400",
                            surface.kind === "all" && "border-violet-500/40 text-violet-400",
                            surface.kind === "vfs_static" && "border-zinc-500/40 text-zinc-400",
                          )}
                        >
                          {surface.kind}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border/20 bg-background/30 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-foreground">Variants</div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => playground.updateProduct(selectedProduct.productId, {
                      variants: [...(selectedProduct.variants || []), { label: "New Variant" }],
                    })}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Variant
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  {(selectedProduct.variants || []).length === 0 && <div className="text-[11px] text-muted-foreground">No variants configured.</div>}
                  {(selectedProduct.variants || []).map((variant, index) => (
                    <div key={`${selectedProduct.productId}-variant-${index}`} className="grid gap-2 md:grid-cols-[1fr_120px_140px_auto]">
                      <Input
                        value={variant.label}
                        onChange={(e) => {
                          const variants = [...(selectedProduct.variants || [])];
                          variants[index] = { ...variants[index], label: e.target.value };
                          playground.updateProduct(selectedProduct.productId, { variants });
                        }}
                        className="h-8 text-xs"
                        placeholder="Label"
                      />
                      <Input
                        type="number"
                        value={variant.price ?? ""}
                        onChange={(e) => {
                          const variants = [...(selectedProduct.variants || [])];
                          variants[index] = { ...variants[index], price: e.target.value ? Number(e.target.value) : undefined };
                          playground.updateProduct(selectedProduct.productId, { variants });
                        }}
                        className="h-8 text-xs"
                        placeholder="Price"
                      />
                      <Input
                        value={variant.sku || ""}
                        onChange={(e) => {
                          const variants = [...(selectedProduct.variants || [])];
                          variants[index] = { ...variants[index], sku: e.target.value };
                          playground.updateProduct(selectedProduct.productId, { variants });
                        }}
                        className="h-8 text-xs"
                        placeholder="Variant SKU"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          const variants = [...(selectedProduct.variants || [])];
                          variants.splice(index, 1);
                          playground.updateProduct(selectedProduct.productId, { variants });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

/**
 * Inline mini-editor for a collection — opens from a pencil affordance on the
 * collection pill. Lets you rename, manage members (multi-select with search),
 * and delete the collection without leaving the Products/Services tab.
 */
function CollectionPillEditor({
  playground,
  collectionId,
  candidates,
  itemKind,
}: {
  playground: UseCreatorPlaygroundReturn;
  collectionId: string;
  candidates: Array<{ id: string; name: string; meta?: string }>;
  itemKind: "products" | "services";
}) {
  const collection = playground.creatorData.collections[collectionId];
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  if (!collection) return null;

  const memberSet = new Set(collection.itemIds);
  const filtered = candidates.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.meta || "").toLowerCase().includes(q);
  });

  const toggle = (id: string) => {
    const has = collection.itemIds.includes(id);
    const itemIds = has ? collection.itemIds.filter((x) => x !== id) : [...collection.itemIds, id];
    playground.updateCollection(collectionId, { itemIds });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full border border-border/30 bg-muted/10 p-0.5 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
          title={`Edit "${collection.name}"`}
          onClick={(e) => e.stopPropagation()}
        >
          <Pencil className="h-2.5 w-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-3 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Collection name</div>
          <Input
            value={collection.name}
            onChange={(e) => playground.updateCollection(collectionId, { name: e.target.value })}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Members · {collection.itemIds.length}
            </div>
            <div className="text-[10px] text-muted-foreground/70">
              {itemKind === "products" ? "Products" : "Services"}
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-7 pl-6 text-xs"
            />
          </div>
          <div className="max-h-56 overflow-y-auto rounded-md border border-border/30 bg-muted/5">
            {filtered.length === 0 ? (
              <div className="px-2.5 py-3 text-[11px] text-center text-muted-foreground">
                No {itemKind === "products" ? "products" : "services"} match.
              </div>
            ) : (
              filtered.map((c) => {
                const member = memberSet.has(c.id);
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs border-b border-border/10 last:border-b-0 transition-colors",
                      member ? "bg-sky-500/10 text-foreground" : "hover:bg-muted/20 text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border",
                        member ? "border-sky-500/60 bg-sky-500/30 text-sky-100" : "border-border/40",
                      )}
                    >
                      {member && <CheckCircle className="h-2.5 w-2.5" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {c.meta && <span className="text-[10px] text-muted-foreground/70 shrink-0">{c.meta}</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/20 pt-2">
          <div className="text-[10px] text-muted-foreground">
            Bound via <code className="rounded bg-muted/40 px-1">collectionId</code>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] text-destructive hover:bg-destructive/10"
            onClick={() => {
              playground.removeCollection(collectionId);
              setOpen(false);
            }}
          >
            <Trash2 className="mr-1 h-3 w-3" /> Delete
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}


type ServiceFilter = "all" | "bookable" | "featured" | "not_bookable";

function ServicesSection({ playground, vfsFiles, onNavigateToPage }: { playground: UseCreatorPlaygroundReturn; vfsFiles: Record<string, string>; onNavigateToPage?: (pageId: string) => void }) {
  const allServices = useMemo(
    () => Object.values(playground.creatorData.services).sort((a, b) => a.sortOrder - b.sortOrder),
    [playground.creatorData.services],
  );
  const collections = useMemo(
    () => Object.values(playground.creatorData.collections).filter((c) => c.type === "services"),
    [playground.creatorData.collections],
  );

  const [filter, setFilter] = useState<ServiceFilter>("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(allServices[0]?.serviceId || null);

  const homePageId = playground.pageRegistry.homePageId
    || Object.values(playground.pageRegistry.pages).find((p) => p.isHome)?.pageId
    || Object.values(playground.pageRegistry.pages)[0]?.pageId
    || null;

  const insertOrphanFix = (service: typeof allServices[number], source: "featured" | "all") => {
    if (!homePageId) return;
    const created = playground.addComponentInstance({
      componentType: "ServiceGrid",
      componentSlug: "service-grid",
      label: source === "featured" ? "Featured Services" : "All Services",
      bindings: { source },
      props: { source, title: source === "featured" ? "Featured Services" : "All Services" },
      usedOnPages: [homePageId],
    });
    if (created && onNavigateToPage) onNavigateToPage(homePageId);
  };

  const stats = useMemo(() => {
    let bookable = 0, featured = 0, notBookable = 0;
    for (const s of allServices) {
      if (s.bookable) bookable++; else notBookable++;
      if (s.featured) featured++;
    }
    return { total: allServices.length, bookable, featured, notBookable };
  }, [allServices]);

  const services = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allServices.filter((s) => {
      if (filter === "bookable" && !s.bookable) return false;
      if (filter === "not_bookable" && s.bookable) return false;
      if (filter === "featured" && !s.featured) return false;
      if (q && !`${s.name} ${s.serviceCode || ""} ${s.category || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allServices, filter, search]);

  useEffect(() => {
    if (!selectedServiceId || !playground.creatorData.services[selectedServiceId]) {
      setSelectedServiceId(allServices[0]?.serviceId || null);
    }
  }, [playground.creatorData.services, selectedServiceId, allServices]);

  const selectedService = selectedServiceId ? playground.creatorData.services[selectedServiceId] : null;

  const selectedServiceCollections = useMemo(() => {
    if (!selectedService) return [];
    return collections.filter((c) => c.itemIds.includes(selectedService.serviceId));
  }, [collections, selectedService]);

  const selectedServiceSurfaces = useMemo(() => {
    if (!selectedService) return [];
    return getServiceSurfaces(selectedService, playground.creatorData, playground.pageRegistry, vfsFiles);
  }, [selectedService, playground.creatorData, playground.pageRegistry, vfsFiles]);

  const serviceSurfaceCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of allServices) {
      m.set(s.serviceId, getServiceSurfaces(s, playground.creatorData, playground.pageRegistry, vfsFiles).length);
    }
    return m;
  }, [allServices, playground.creatorData, playground.pageRegistry, vfsFiles]);

  const toggleServiceInCollection = (collectionId: string) => {
    if (!selectedService) return;
    const col = playground.creatorData.collections[collectionId];
    if (!col) return;
    const has = col.itemIds.includes(selectedService.serviceId);
    const itemIds = has
      ? col.itemIds.filter((id) => id !== selectedService.serviceId)
      : [...col.itemIds, selectedService.serviceId];
    playground.updateCollection(collectionId, { itemIds });
  };

  const filterChips: { value: ServiceFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: stats.total },
    { value: "bookable", label: "Bookable", count: stats.bookable },
    { value: "featured", label: "Featured", count: stats.featured },
    { value: "not_bookable", label: "Not Bookable", count: stats.notBookable },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-emerald-500" /> Services
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Live-bound to <code className="rounded bg-muted/40 px-1 py-px text-[10px]">@/unison/services</code> — edits flow into ServiceCard, BookingCard, and booking flows at runtime.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border/30 bg-muted/10 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors",
                viewMode === "list" ? "bg-emerald-500/15 text-foreground" : "text-muted-foreground hover:bg-muted/20",
              )}
              title="List view"
            >
              <LayoutGrid className="h-3 w-3" /> List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("graph")}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] transition-colors",
                viewMode === "graph" ? "bg-emerald-500/15 text-foreground" : "text-muted-foreground hover:bg-muted/20",
              )}
              title="Topology graph view"
            >
              <Network className="h-3 w-3" /> Graph
            </button>
          </div>
          <Button
            size="sm"
            className="h-8 px-3"
            onClick={() => {
              const created = playground.addService({
                name: "New Service",
                description: "",
                price: 150,
                duration: 60,
                currency: "USD",
                bookable: true,
                ctaLabel: "Book Now",
              });
              setSelectedServiceId(created.serviceId);
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Service
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          { label: "Total", value: stats.total, tone: "text-foreground" },
          { label: "Bookable", value: stats.bookable, tone: "text-emerald-500" },
          { label: "Featured", value: stats.featured, tone: "text-amber-500" },
          { label: "Not Bookable", value: stats.notBookable, tone: "text-muted-foreground" },
          { label: "Collections", value: collections.length, tone: "text-sky-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border/30 bg-muted/10 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
            <div className={cn("text-lg font-semibold leading-tight", s.tone)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter + search */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {filterChips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setFilter(chip.value)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                filter === chip.value
                  ? "border-emerald-500/40 bg-emerald-500/15 text-foreground"
                  : "border-border/30 bg-muted/10 text-muted-foreground hover:bg-muted/20",
              )}
            >
              {chip.label}
              <span className="ml-1 text-muted-foreground/70">{chip.count}</span>
            </button>
          ))}
        </div>
        <div className="relative md:w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, code, category…"
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      {viewMode === "graph" ? (
        <CatalogGraph
          playground={playground}
          vfsFiles={vfsFiles}
          mode="services"
          onSelect={(serviceId) => { setSelectedServiceId(serviceId); setViewMode("list"); }}
          onNavigateToPage={onNavigateToPage}
          selectedItemId={selectedServiceId}
        />
      ) : (
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2">
          {services.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/30 bg-muted/5 px-3 py-6 text-center text-xs text-muted-foreground">
              {allServices.length === 0 ? "No services yet — add one to start binding." : "No services match this filter."}
            </div>
          )}
          {services.map((service) => {
            const serviceCollectionsCount = collections.filter((c) => c.itemIds.includes(service.serviceId)).length;
            const surfaceCount = serviceSurfaceCounts.get(service.serviceId) ?? 0;
            return (
              <button
                key={service.serviceId}
                type="button"
                onClick={() => setSelectedServiceId(service.serviceId)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  selectedServiceId === service.serviceId ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/30 bg-muted/10 hover:bg-muted/20",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="truncate text-sm font-medium text-foreground">{service.name}</div>
                      {service.featured && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {service.duration ? `${service.duration} min` : "Flexible duration"}
                      {service.price ? ` • ${service.currency || "USD"} ${service.price}` : ""}
                      {service.serviceCode ? <span className="ml-2 font-mono opacity-70">{service.serviceCode}</span> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", service.bookable ? "border-emerald-500/40 text-emerald-500" : "border-muted-foreground/40 text-muted-foreground")}>
                        {service.bookable ? "Bookable" : "Not Bookable"}
                      </Badge>
                      {serviceCollectionsCount > 0 && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-sky-500/40 text-sky-500">
                          <Layers className="mr-0.5 h-2.5 w-2.5" />{serviceCollectionsCount}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] h-4 px-1.5",
                          surfaceCount === 0 ? "border-rose-500/40 text-rose-400" : "border-emerald-500/40 text-emerald-500",
                        )}
                        title={surfaceCount === 0 ? "Orphaned — not rendered on any page" : `Appears on ${surfaceCount} surface${surfaceCount === 1 ? "" : "s"}`}
                      >
                        <Link2 className="mr-0.5 h-2.5 w-2.5" />{surfaceCount}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      playground.removeService(service.serviceId);
                      if (selectedServiceId === service.serviceId) setSelectedServiceId(null);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-border/30 bg-muted/10 p-4">
          {!selectedService ? (
            <p className="text-sm text-muted-foreground">Select a service to customize it.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Service Name"><Input value={selectedService.name} onChange={(e) => playground.updateService(selectedService.serviceId, { name: e.target.value })} className="h-9 text-sm" /></Field>
                <Field label="Slug"><Input value={selectedService.slug || ""} onChange={(e) => playground.updateService(selectedService.serviceId, { slug: e.target.value })} className="h-9 text-sm" /></Field>
                <Field label="Service Code"><Input value={selectedService.serviceCode || ""} onChange={(e) => playground.updateService(selectedService.serviceId, { serviceCode: e.target.value })} className="h-9 text-sm" /></Field>
                <Field label="Category"><Input value={selectedService.category || ""} onChange={(e) => playground.updateService(selectedService.serviceId, { category: e.target.value })} className="h-9 text-sm" /></Field>
                <Field label="Price"><Input type="number" value={selectedService.price ?? ""} onChange={(e) => playground.updateService(selectedService.serviceId, { price: e.target.value ? Number(e.target.value) : undefined })} className="h-9 text-sm" /></Field>
                <Field label="Duration (min)"><Input type="number" value={selectedService.duration ?? ""} onChange={(e) => playground.updateService(selectedService.serviceId, { duration: e.target.value ? Number(e.target.value) : undefined })} className="h-9 text-sm" /></Field>
                <Field label="Location"><Input value={selectedService.locationLabel || ""} onChange={(e) => playground.updateService(selectedService.serviceId, { locationLabel: e.target.value })} className="h-9 text-sm" /></Field>
                <Field label="CTA Label"><Input value={selectedService.ctaLabel || ""} onChange={(e) => playground.updateService(selectedService.serviceId, { ctaLabel: e.target.value })} className="h-9 text-sm" /></Field>
              </div>
              <Field label="Description">
                <Textarea value={selectedService.description || ""} onChange={(e) => playground.updateService(selectedService.serviceId, { description: e.target.value })} className="min-h-[88px] text-sm" />
              </Field>
              <Field label="Availability Summary"><Input value={selectedService.availabilitySummary || ""} onChange={(e) => playground.updateService(selectedService.serviceId, { availabilitySummary: e.target.value })} placeholder="Mon-Fri • 9am-5pm" className="h-9 text-sm" /></Field>
              <div className="flex flex-wrap gap-2">
                <Button variant={selectedService.bookable ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => playground.updateService(selectedService.serviceId, { bookable: !selectedService.bookable })}>
                  {selectedService.bookable ? "Bookable" : "Not Bookable"}
                </Button>
                <Button variant={selectedService.featured ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => playground.updateService(selectedService.serviceId, { featured: !selectedService.featured })}>
                  {selectedService.featured ? "Featured" : "Mark Featured"}
                </Button>
              </div>

              {/* Collections binding */}
              <div className="rounded-lg border border-border/20 bg-background/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Layers className="h-3.5 w-3.5 text-sky-500" /> Collections
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      playground.addCollection({ name: "New Collection", type: "services", itemIds: [selectedService.serviceId] });
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" /> New
                  </Button>
                </div>
                {collections.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground">No service collections yet.</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {collections.map((c) => {
                      const member = c.itemIds.includes(selectedService.serviceId);
                      return (
                        <div
                          key={c.collectionId}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-0.5 text-[11px] transition-colors",
                            member
                              ? "border-sky-500/40 bg-sky-500/15 text-foreground"
                              : "border-border/30 bg-muted/10 text-muted-foreground hover:bg-muted/20",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => toggleServiceInCollection(c.collectionId)}
                            className="inline-flex items-center gap-1"
                            title={member ? "Remove from collection" : "Add to collection"}
                          >
                            {member ? "✓ " : "+ "}{c.name}
                            <span className="ml-0.5 opacity-60">{c.itemIds.length}</span>
                          </button>
                          <CollectionPillEditor
                            playground={playground}
                            collectionId={c.collectionId}
                            itemKind="services"
                            candidates={allServices.map((s) => ({ id: s.serviceId, name: s.name, meta: s.duration ? `${s.duration} min` : "" }))}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Topology — where this service appears */}
              <div className="rounded-lg border border-border/20 bg-background/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Link2 className="h-3.5 w-3.5 text-emerald-500" /> Appears on
                  </div>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                    {selectedServiceSurfaces.length} surface{selectedServiceSurfaces.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Real bindings + VFS scan: where this service is rendered in the preview canvas right now.
                </p>
                {selectedServiceSurfaces.length === 0 ? (
                  <div className="rounded border border-dashed border-rose-500/30 bg-rose-500/5 px-2.5 py-2 text-[11px] text-rose-300 space-y-2">
                    <div>
                      <strong className="font-semibold">Orphaned</strong> — not rendered anywhere yet. Add a <code className="rounded bg-muted/40 px-1 text-[10px]">ServiceGrid</code> on Home, or drop it into a collection above.
                    </div>
                    {homePageId && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedService.featured && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                            onClick={() => insertOrphanFix(selectedService, "featured")}
                          >
                            <Plus className="mr-1 h-3 w-3" /> Insert Featured Grid on Home
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] border-violet-500/40 text-violet-300 hover:bg-violet-500/10"
                          onClick={() => insertOrphanFix(selectedService, "all")}
                        >
                          <Plus className="mr-1 h-3 w-3" /> Insert All-Services Grid on Home
                        </Button>
                        {!selectedService.featured && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px]"
                            onClick={() => playground.updateService(selectedService.serviceId, { featured: true })}
                          >
                            <Star className="mr-1 h-3 w-3" /> Mark Featured
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {selectedServiceSurfaces.map((surface) => (
                      <button
                        type="button"
                        key={surface.id}
                        disabled={!surface.pageId || !onNavigateToPage}
                        onClick={() => surface.pageId && onNavigateToPage?.(surface.pageId)}
                        className={cn(
                          "w-full text-left flex items-center justify-between gap-2 rounded-md border border-border/20 bg-muted/10 px-2.5 py-1.5 transition-colors",
                          surface.pageId && onNavigateToPage ? "hover:bg-muted/20 cursor-pointer" : "cursor-default opacity-90",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-foreground">
                            {surface.pageLabel}
                            {surface.pageSlug ? <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{surface.pageSlug}</span> : null}
                          </div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            <span className="font-mono">{surface.componentType}</span>
                            <span className="ml-1.5">·</span>
                            <span className="ml-1.5">{surface.kind === "vfs_static" ? "static jsx" : surface.kind}</span>
                            {surface.source ? <span className="ml-1.5">· source: <span className="font-mono">{surface.source}</span></span> : null}
                            {surface.collectionName ? <span className="ml-1.5">· collection: <span className="font-mono">{surface.collectionName}</span></span> : null}
                            {surface.filePath ? <span className="ml-1.5 opacity-70">· {surface.filePath.replace(/^\/src\//, "")}</span> : null}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] h-4 px-1.5",
                            surface.kind === "direct" && "border-emerald-500/40 text-emerald-400",
                            surface.kind === "featured" && "border-amber-500/40 text-amber-400",
                            surface.kind === "collection" && "border-sky-500/40 text-sky-400",
                            surface.kind === "all" && "border-violet-500/40 text-violet-400",
                            surface.kind === "vfs_static" && "border-zinc-500/40 text-zinc-400",
                          )}
                        >
                          {surface.kind}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function FormsSection({ playground }: { playground: UseCreatorPlaygroundReturn }) {
  const forms = Object.values(playground.creatorData.forms).sort((a, b) => a.sortOrder - b.sortOrder);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(forms[0]?.formId || null);

  useEffect(() => {
    if (!selectedFormId || !playground.creatorData.forms[selectedFormId]) {
      setSelectedFormId(forms[0]?.formId || null);
    }
  }, [forms, playground.creatorData.forms, selectedFormId]);

  const selectedForm = selectedFormId ? playground.creatorData.forms[selectedFormId] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground">Forms</h2>
          <p className="mt-1 text-xs text-muted-foreground">Build lead capture, order, and booking forms directly inside the control plane.</p>
        </div>
        <Button
          size="sm"
          className="h-8 px-3"
          onClick={() => {
            const created = playground.addForm({
              name: "New Form",
              fields: [{ fieldId: "f1", label: "Email", type: "email", required: true, sortOrder: 0, width: "full" }],
              submitLabel: "Submit",
              successMessage: "Thanks!",
              destinationType: "crm",
            });
            setSelectedFormId(created.formId);
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Form
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-2">
          {forms.length === 0 && <p className="text-sm text-muted-foreground">No forms configured yet.</p>}
          {forms.map((form) => (
            <button
              key={form.formId}
              type="button"
              onClick={() => setSelectedFormId(form.formId)}
              className={cn(
                "w-full rounded-xl border p-3 text-left transition-colors",
                selectedFormId === form.formId ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/30 bg-muted/10 hover:bg-muted/20",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">{form.name}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{form.fields.length} fields • {form.destinationType || "crm"}</div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    playground.removeForm(form.formId);
                    if (selectedFormId === form.formId) setSelectedFormId(null);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border/30 bg-muted/10 p-4">
          {!selectedForm ? (
            <p className="text-sm text-muted-foreground">Select a form to customize it.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Form Name"><Input value={selectedForm.name} onChange={(e) => playground.updateForm(selectedForm.formId, { name: e.target.value })} className="h-9 text-sm" /></Field>
                <Field label="Theme"><Input value={selectedForm.themeName || ""} onChange={(e) => playground.updateForm(selectedForm.formId, { themeName: e.target.value })} className="h-9 text-sm" placeholder="Minimal Dark" /></Field>
                <Field label="Submit Label"><Input value={selectedForm.submitLabel} onChange={(e) => playground.updateForm(selectedForm.formId, { submitLabel: e.target.value })} className="h-9 text-sm" /></Field>
                <Field label="Destination">
                  <Select value={selectedForm.destinationType || "crm"} onValueChange={(value) => playground.updateForm(selectedForm.formId, { destinationType: value as "crm" | "email" | "webhook" | "calendar" | "custom" })}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crm">CRM</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                      <SelectItem value="calendar">Calendar</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Destination Label"><Input value={selectedForm.destinationLabel || ""} onChange={(e) => playground.updateForm(selectedForm.formId, { destinationLabel: e.target.value })} className="h-9 text-sm" placeholder="Sales Pipeline" /></Field>
              </div>

              <Field label="Success Message">
                <Textarea value={selectedForm.successMessage} onChange={(e) => playground.updateForm(selectedForm.formId, { successMessage: e.target.value })} className="min-h-[80px] text-sm" />
              </Field>

              <div className="flex flex-wrap gap-2">
                <Button variant={selectedForm.enablePayments ? "default" : "outline"} size="sm" className="h-8 text-xs" onClick={() => playground.updateForm(selectedForm.formId, { enablePayments: !selectedForm.enablePayments })}>
                  {selectedForm.enablePayments ? "Payments Enabled" : "Enable Payments"}
                </Button>
              </div>

              <div className="rounded-lg border border-border/20 bg-background/30 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-foreground">Fields</div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => playground.updateForm(selectedForm.formId, {
                      fields: [
                        ...selectedForm.fields,
                        {
                          fieldId: `f${selectedForm.fields.length + 1}`,
                          label: "New Field",
                          type: "text",
                          required: false,
                          sortOrder: selectedForm.fields.length,
                          width: "full",
                        },
                      ],
                    })}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add Field
                  </Button>
                </div>
                <div className="mt-3 space-y-3">
                  {selectedForm.fields.map((field, index) => (
                    <div key={field.fieldId} className="rounded-lg border border-border/20 bg-muted/10 p-3">
                      <div className="grid gap-2 md:grid-cols-[1fr_140px_120px_auto]">
                        <Input
                          value={field.label}
                          onChange={(e) => {
                            const fields = [...selectedForm.fields];
                            fields[index] = { ...fields[index], label: e.target.value };
                            playground.updateForm(selectedForm.formId, { fields });
                          }}
                          className="h-8 text-xs"
                          placeholder="Field label"
                        />
                        <Select
                          value={field.type}
                          onValueChange={(value) => {
                            const fields = [...selectedForm.fields];
                            fields[index] = { ...fields[index], type: value as typeof field.type };
                            playground.updateForm(selectedForm.formId, { fields });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="phone">Phone</SelectItem>
                            <SelectItem value="textarea">Textarea</SelectItem>
                            <SelectItem value="select">Select</SelectItem>
                            <SelectItem value="checkbox">Checkbox</SelectItem>
                            <SelectItem value="date">Date</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={field.width || "full"}
                          onValueChange={(value) => {
                            const fields = [...selectedForm.fields];
                            fields[index] = { ...fields[index], width: value as "full" | "half" };
                            playground.updateForm(selectedForm.formId, { fields });
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Full Width</SelectItem>
                            <SelectItem value="half">Half Width</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            const fields = [...selectedForm.fields];
                            fields.splice(index, 1);
                            playground.updateForm(selectedForm.formId, { fields: fields.map((item, itemIndex) => ({ ...item, sortOrder: itemIndex })) });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                        <Input
                          value={field.placeholder || ""}
                          onChange={(e) => {
                            const fields = [...selectedForm.fields];
                            fields[index] = { ...fields[index], placeholder: e.target.value };
                            playground.updateForm(selectedForm.formId, { fields });
                          }}
                          className="h-8 text-xs"
                          placeholder="Placeholder"
                        />
                        <Input
                          value={field.helpText || ""}
                          onChange={(e) => {
                            const fields = [...selectedForm.fields];
                            fields[index] = { ...fields[index], helpText: e.target.value };
                            playground.updateForm(selectedForm.formId, { fields });
                          }}
                          className="h-8 text-xs"
                          placeholder="Help text"
                        />
                        <Button
                          variant={field.required ? "default" : "outline"}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => {
                            const fields = [...selectedForm.fields];
                            fields[index] = { ...fields[index], required: !fields[index].required };
                            playground.updateForm(selectedForm.formId, { fields });
                          }}
                        >
                          {field.required ? "Required" : "Optional"}
                        </Button>
                      </div>
                      {field.type === "select" && (
                        <Input
                          value={(field.options || []).join(", ")}
                          onChange={(e) => {
                            const fields = [...selectedForm.fields];
                            fields[index] = { ...fields[index], options: toCommaList(e.target.value) };
                            playground.updateForm(selectedForm.formId, { fields });
                          }}
                          className="mt-2 h-8 text-xs"
                          placeholder="Option A, Option B, Option C"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getDefaultComponentBindings(
  slug: string,
  playground: UseCreatorPlaygroundReturn,
  calendars: Record<string, PlaygroundCalendar>,
) {
  const firstForm = Object.values(playground.creatorData.forms)[0];
  const firstKnownCalendar = Object.values(calendars)[0];
  const firstProduct = Object.values(playground.creatorData.products)[0];

  switch (slug) {
    case "contact-form":
    case "request-quote":
    case "newsletter-signup":
      return firstForm ? { formId: firstForm.formId } : {};
    case "booking-scheduler":
      return firstKnownCalendar ? { calendarId: firstKnownCalendar.calendarId } : {};
    case "checkout-cta":
      return firstProduct ? { productId: firstProduct.productId } : {};
    default:
      return {};
  }
}

function getDefaultComponentPages(slug: string, playground: UseCreatorPlaygroundReturn) {
  const pages = playground.getAllPages();
  const homePageId = pages.find((page) => page.isHome)?.pageId;
  const contactPageId = pages.find((page) => page.pageType === "contact")?.pageId;
  const bookingPageId = pages.find((page) => page.pageType === "booking")?.pageId;
  const shopPageId = pages.find((page) => page.pageType === "shop" || page.pageType === "pricing")?.pageId;

  if (slug === "booking-scheduler") return [bookingPageId || homePageId].filter(Boolean) as string[];
  if (slug === "checkout-cta") return [shopPageId || homePageId].filter(Boolean) as string[];
  if (slug === "chat-widget") return [homePageId].filter(Boolean) as string[];
  return [contactPageId || homePageId].filter(Boolean) as string[];
}

function ComponentsSection({
  playground,
  calendars,
  readinessReport,
}: {
  playground: UseCreatorPlaygroundReturn;
  calendars: Record<string, PlaygroundCalendar>;
  readinessReport: PlaygroundIntentReadinessReport;
}) {
  const componentList = Object.values(playground.creatorData.componentInstances);
  const pagesById = playground.pageRegistry.pages;

  return (
    <div className="space-y-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Components</h2>
          <p className="mt-1 text-xs text-slate-500">Reusable graph nodes rendered exactly as they appear on their assigned pages.</p>
        </div>
        <Badge variant="outline" className="text-[10px]">{componentList.length} instances</Badge>
      </div>

      <div className="rounded-xl border border-border/30 bg-muted/10 p-4">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Add Canonical Primitive</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CANONICAL_COMPONENT_DEFINITIONS.map((definition) => (
            <Button
              key={definition.slug}
              variant="outline"
              size="sm"
              className="h-8 text-[11px]"
              onClick={() => {
                const nextInstance = createCanonicalComponentInstance(definition.slug, {
                  label: definition.name,
                  usedOnPages: getDefaultComponentPages(definition.slug, playground),
                  bindings: getDefaultComponentBindings(definition.slug, playground, calendars),
                });
                if (nextInstance) playground.addComponentInstance(nextInstance);
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {definition.name}
            </Button>
          ))}
        </div>
      </div>

      {componentList.length === 0 ? (
        <p className="text-sm text-muted-foreground">No canonical component instances exist yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {componentList.map((component) => {
            const readiness = readinessReport.componentReadiness[component.instanceId];
            const pageLabels = component.usedOnPages.map((pageId) => pagesById[pageId]?.title || pageId).join(", ") || "none";
            const previewRoute = pagesById[component.usedOnPages[0]]?.path ?? "/";
            const bindingSummary = Object.entries(component.bindings || {})
              .map(([key, value]) => `${key}: ${value}`)
              .join(" • ") || "no bindings";

            return (
              <article key={component.instanceId} className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10171d] transition hover:-translate-y-0.5 hover:border-emerald-400/30">
                <LiveRuntimePreview kind="component" targetId={component.instanceId} componentSlug={component.componentSlug} name={component.label} route={previewRoute} className="h-44 border-b border-white/[0.07]" />
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-medium text-foreground">{component.label}</div>
                      <Badge variant="outline" className="text-[9px] h-5 px-1.5">{component.componentSlug || component.componentType}</Badge>
                      <Badge variant="outline" className={cn("text-[9px] h-5 px-1.5", getReadinessBadgeClass(readiness?.previewStatus))}>Preview {readiness?.previewStatus || component.status || "draft"}</Badge>
                      <Badge variant="outline" className={cn("text-[9px] h-5 px-1.5", getReadinessBadgeClass(readiness?.publishStatus))}>Publish {readiness?.publishStatus || component.status || "draft"}</Badge>
                    </div>
                    <div className="mt-2 truncate text-[11px] text-muted-foreground">Pages: {pageLabels}</div>
                    <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">Bindings: {bindingSummary}</div>
                    {readiness?.missingDependencies.length ? (
                      <div className="mt-2 text-[11px] text-amber-400">
                        Needs: {readiness.missingDependencies.join(", ")}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${component.label}`}
                    className="h-7 w-7 text-slate-500 hover:text-red-300"
                    onClick={() => playground.removeComponentInstance(component.instanceId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CalendarsSection({ calendars, registry }: { calendars: Record<string, PlaygroundCalendar>; registry: PageRegistry }) {
  const list = Object.values(calendars).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Calendars</h2>
        <Badge variant="outline" className="text-[10px]">{list.length} calendars</Badge>
      </div>
      {list.map((calendar) => (
        <div key={calendar.calendarId} className="rounded-xl border border-border/30 bg-muted/10 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10"><Calendar className="h-4 w-4 text-cyan-400" /></div>
            <div>
              <div className="text-sm font-medium text-foreground">{calendar.name}</div>
              <div className="text-[11px] text-muted-foreground">{BOOKING_TYPE_LABELS[calendar.bookingType] || calendar.bookingType} • {calendar.defaultDuration} min</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">
            Pages: {calendar.attachedPageIds.map((pageId) => getPageTitle(registry, pageId)).join(", ") || "none"}
          </div>
        </div>
      ))}
      {list.length === 0 && <p className="text-sm text-muted-foreground">No calendars configured yet.</p>}
    </div>
  );
}

function PopupsSection({ popups, registry }: { popups: Record<string, PlaygroundPopup>; registry: PageRegistry }) {
  const list = Object.values(popups).sort((a, b) => a.sortOrder - b.sortOrder);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Popups</h2>
        <Badge variant="outline" className="text-[10px]">{list.length} popups</Badge>
      </div>
      {list.map((popup) => (
        <div key={popup.popupId} className="rounded-xl border border-border/30 bg-muted/10 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-fuchsia-500/10"><MessageSquare className="h-4 w-4 text-fuchsia-400" /></div>
            <div>
              <div className="text-sm font-medium text-foreground">{popup.name}</div>
              <div className="text-[11px] text-muted-foreground">{POPUP_TRIGGER_LABELS[popup.trigger] || popup.trigger} • {popup.contentType}</div>
            </div>
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">
            Active on: {popup.activeOnPageIds.map((pageId) => getPageTitle(registry, pageId)).join(", ") || "none"}
          </div>
        </div>
      ))}
      {list.length === 0 && <p className="text-sm text-muted-foreground">No popups configured yet.</p>}
    </div>
  );
}

function SimpleObjectSection({
  title,
  empty,
  items,
  onRemove,
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; label: string; meta: string }>;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      <SimpleObjectList items={items} onRemove={onRemove} empty={empty} />
    </div>
  );
}

function SimpleObjectList({
  items,
  onRemove,
  empty,
}: {
  items: Array<{ id: string; label: string; meta: string }>;
  onRemove: (id: string) => void;
  empty: string;
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="group flex items-center justify-between p-3 rounded-lg border border-border/30 bg-muted/10">
          <div>
            <div className="text-sm font-medium text-foreground">{item.label}</div>
            <div className="text-xs text-muted-foreground">{item.meta}</div>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100" onClick={() => onRemove(item.id)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function BusinessSection({
  playground,
  setupSnapshot,
  focusField,
  onFocusHandled,
}: {
  playground: UseCreatorPlaygroundReturn;
  setupSnapshot?: PlaygroundSetupSnapshot;
  focusField?: PlaygroundSetupField | null;
  onFocusHandled?: () => void;
}) {
  const info = playground.creatorData.businessInfo;
  const fieldRefs = useRef<Partial<Record<PlaygroundSetupField, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (!focusField) return;
    const target = fieldRefs.current[focusField];
    if (target) {
      target.focus();
      target.select();
      onFocusHandled?.();
    }
  }, [focusField, onFocusHandled]);

  const bindFieldRef = (field: PlaygroundSetupField) => (element: HTMLInputElement | null) => {
    fieldRefs.current[field] = element;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-foreground">Business Setup</h2>
          <p className="text-xs text-muted-foreground mt-1">Resolve operational gaps here so publish readiness has a concrete owner, destination, and provider.</p>
        </div>
        <div className="rounded-lg border border-border/20 bg-muted/10 px-3 py-2 text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Publish</div>
          <div className={cn("text-sm font-medium", setupSnapshot?.publishStatus ? "text-foreground" : "text-amber-400")}>{setupSnapshot?.publishStatus || "draft"}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Business Name"><Input ref={bindFieldRef("businessName")} value={info.businessName} onChange={(e) => playground.updateBusinessInfo({ businessName: e.target.value })} className="h-9 text-sm" /></Field>
        <Field label="Tagline"><Input value={info.tagline || ""} onChange={(e) => playground.updateBusinessInfo({ tagline: e.target.value })} className="h-9 text-sm" /></Field>
        <Field label="Phone"><Input ref={bindFieldRef("phone")} value={info.phone || ""} onChange={(e) => playground.updateBusinessInfo({ phone: e.target.value })} className="h-9 text-sm" /></Field>
        <Field label="Email"><Input ref={bindFieldRef("email")} value={info.email || ""} onChange={(e) => playground.updateBusinessInfo({ email: e.target.value })} className="h-9 text-sm" /></Field>
        <Field label="Address"><Input ref={bindFieldRef("address")} value={info.address || ""} onChange={(e) => playground.updateBusinessInfo({ address: e.target.value })} className="h-9 text-sm" /></Field>
        <Field label="Notification Email"><Input ref={bindFieldRef("notificationEmail")} value={info.notificationEmail ?? setupSnapshot?.notificationEmail ?? ""} onChange={(e) => playground.updateBusinessInfo({ notificationEmail: e.target.value })} className="h-9 text-sm" /></Field>
        <Field label="Booking Owner"><Input ref={bindFieldRef("bookingOwner")} value={info.bookingOwner || ""} onChange={(e) => playground.updateBusinessInfo({ bookingOwner: e.target.value })} className="h-9 text-sm" /></Field>
        <Field label="Payment Provider"><Input ref={bindFieldRef("paymentProvider")} value={info.paymentProvider || ""} onChange={(e) => playground.updateBusinessInfo({ paymentProvider: e.target.value })} className="h-9 text-sm" /></Field>
        <Field label="CRM Destination"><Input ref={bindFieldRef("crmDestination")} value={info.crmDestination || ""} onChange={(e) => playground.updateBusinessInfo({ crmDestination: e.target.value })} className="h-9 text-sm" /></Field>
        <Field label="Publish Domain"><Input ref={bindFieldRef("publishDomain")} value={info.publishDomain ?? setupSnapshot?.customDomain ?? ""} onChange={(e) => playground.updateBusinessInfo({ publishDomain: e.target.value })} className="h-9 text-sm" /></Field>
        <Field label="Follow-up Channel"><Input ref={bindFieldRef("followUpChannel")} value={info.followUpChannel || ""} onChange={(e) => playground.updateBusinessInfo({ followUpChannel: e.target.value })} className="h-9 text-sm" /></Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function BindingsSection({
  bindings,
  registry,
  readinessReport,
  selectedBindingId,
  onBindingSelect,
  onResolveDependency,
}: {
  bindings: Record<string, PlaygroundBinding>;
  registry: PageRegistry;
  readinessReport: PlaygroundIntentReadinessReport;
  selectedBindingId?: string | null;
  onBindingSelect: (bindingId: string | null) => void;
  onResolveDependency: (dependency: PlaygroundIntentDependency) => void;
}) {
  const bindingList = Object.values(bindings).sort((a, b) => {
    const aBlocked = readinessReport.readiness[a.bindingId]?.publishStatus === "blocked" ? 0 : 1;
    const bBlocked = readinessReport.readiness[b.bindingId]?.publishStatus === "blocked" ? 0 : 1;
    if (aBlocked !== bBlocked) return aBlocked - bBlocked;
    return (a.elementKey || a.bindingId).localeCompare(b.elementKey || b.bindingId);
  });

  if (bindingList.length === 0) {
    return <p className="text-sm text-muted-foreground">No intents are registered yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Intent Registry</h3>
        <p className="text-[10px] text-muted-foreground mt-1">Inspect how each CTA, trigger, and route resolves in preview and publish.</p>
      </div>
      <div className="space-y-2">
        {bindingList.map((binding) => {
          const readiness = readinessReport.readiness[binding.bindingId];
          const isSelected = selectedBindingId === binding.bindingId;
          const targetLabel = binding.targetType === "page" ? getPageTitle(registry, binding.targetId) : readiness?.targetSummary || binding.targetId;

          return (
            <div key={binding.bindingId} className={cn("rounded-xl border bg-muted/10 text-xs", isSelected ? "border-emerald-500/40" : "border-border/30")}>
              <button type="button" onClick={() => onBindingSelect(isSelected ? null : binding.bindingId)} className="w-full px-4 py-3 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">{binding.coreIntent || INTENT_LABELS[binding.intent] || binding.intent}</Badge>
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 capitalize">{binding.uiAction || "navigate"}</Badge>
                      <span className="truncate text-foreground">{targetLabel}</span>
                    </div>
                    <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground md:grid-cols-2">
                      <span>Source: {binding.elementKey || `${getPageTitle(registry, binding.sourcePageId)} / ${binding.sourceLabel || "unnamed"}`}</span>
                      <span>Target Type: {binding.targetType.replace("_", " ")}</span>
                      <span>Preview: <span className="text-foreground">{readiness?.previewStatus || binding.previewStatus || "ready"}</span></span>
                      <span>Publish: <span className="text-foreground">{readiness?.publishStatus || binding.publishStatus || "ready"}</span></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("text-[9px] h-5 px-1.5", getReadinessBadgeClass(readiness?.previewStatus || binding.previewStatus))}>Preview {readiness?.previewStatus || binding.previewStatus || "ready"}</Badge>
                    <Badge variant="outline" className={cn("text-[9px] h-5 px-1.5", getReadinessBadgeClass(readiness?.publishStatus || binding.publishStatus))}>Publish {readiness?.publishStatus || binding.publishStatus || "ready"}</Badge>
                  </div>
                </div>
              </button>

              {isSelected && readiness && (
                <div className="border-t border-border/20 bg-background/30 px-4 py-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Inspector</div>
                      <div className="space-y-1 text-[11px] text-muted-foreground">
                        <div>Canonical intent: <span className="text-foreground">{binding.coreIntent || binding.intent}</span></div>
                        <div>Source page: <span className="text-foreground">{getPageTitle(registry, binding.sourcePageId)}</span></div>
                        <div>Source element key: <span className="text-foreground">{binding.elementKey || "not assigned"}</span></div>
                        <div>Target: <span className="text-foreground">{targetLabel}</span></div>
                        <div>Confidence: <span className="text-foreground">{(binding.confidence * 100).toFixed(0)}%</span></div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Fix Actions</div>
                      {readiness.dependencies.length === 0 ? (
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-400">This intent is ready in preview and publish.</div>
                      ) : (
                        readiness.dependencies.map((dependency) => (
                          <div key={dependency.id} className="rounded-lg border border-border/20 bg-muted/10 px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-[11px] font-medium text-foreground">{dependency.label}</div>
                              <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", getReadinessBadgeClass(dependency.status))}>{dependency.mode} {dependency.status}</Badge>
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">{dependency.message}</div>
                            {dependency.fixHint && <div className="mt-1 text-[10px] text-muted-foreground/80">{dependency.fixHint}</div>}
                            {(dependency.resolverSection || dependency.resolverStepId) && <Button variant="outline" size="sm" className="mt-2 h-7 text-[11px]" onClick={() => onResolveDependency(dependency)}>Resolve</Button>}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReadinessSection({
  validations,
  summary,
  readinessReport,
  registry,
  onInspectBinding,
  onInspectComponent,
  onResolveDependency,
}: {
  validations: PlaygroundValidation[];
  summary: PlaygroundControlPlaneModel["validationSummary"];
  readinessReport: PlaygroundIntentReadinessReport;
  registry: PageRegistry;
  onInspectBinding: (bindingId: string) => void;
  onInspectComponent: () => void;
  onResolveDependency: (dependency: PlaygroundIntentDependency) => void;
}) {
  const blockedBindings = Object.values(readinessReport.bindings).filter((binding) => binding.publishStatus === "blocked");
  const partialBindings = Object.values(readinessReport.bindings).filter((binding) => binding.publishStatus === "partial");
  const blockedComponents = Object.values(readinessReport.componentReadiness).filter((component) => component.publishStatus === "blocked");
  const partialComponents = Object.values(readinessReport.componentReadiness).filter((component) => component.publishStatus === "partial");

  const severityIcon = (severity: PlaygroundValidation["severity"]) => {
    switch (severity) {
      case "error": return <XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />;
      case "warning": return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />;
      case "info": return <Info className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Readiness</h3>
        <p className="text-[10px] text-muted-foreground mt-1">Structural validation tells you whether the graph is coherent. Readiness tells you whether the business action can actually run after publish.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Preview" value={`${readinessReport.summary.previewReady} ready / ${readinessReport.summary.previewPartial} partial / ${readinessReport.summary.previewBlocked} blocked`} />
        <SummaryCard title="Publish" value={`${readinessReport.summary.publishReady} ready / ${readinessReport.summary.publishPartial} partial / ${readinessReport.summary.publishBlocked} blocked`} />
        <SummaryCard title="Components" value={`${readinessReport.summary.componentPublishReady} ready / ${readinessReport.summary.componentPublishBlocked} blocked`} />
        <SummaryCard title="Validation" value={`${summary.errors} errors / ${summary.warnings} warnings / ${summary.info} info`} />
        <SummaryCard title="Publish Blockers" value={`${blockedBindings.length + blockedComponents.length}`} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border/30 bg-muted/10 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Publish Blockers</h4>
            <Badge variant="outline" className="border-red-500/30 text-red-400">{blockedBindings.length}</Badge>
          </div>
          <div className="mt-3 space-y-2">
            {blockedBindings.length === 0 ? (
              blockedComponents.length === 0 ? (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-400">No publish blockers are currently open.</div>
              ) : null
            ) : (
              blockedBindings.map((binding) => {
                const readiness = readinessReport.readiness[binding.bindingId];
                return (
                  <div key={binding.bindingId} className="rounded-lg border border-border/20 bg-background/30 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[11px] font-medium text-foreground">{binding.coreIntent || binding.intent}</div>
                        <div className="text-[10px] text-muted-foreground">{getPageTitle(registry, binding.sourcePageId)} • {binding.elementKey || binding.sourceLabel}</div>
                      </div>
                      <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => onInspectBinding(binding.bindingId)}>Inspect</Button>
                    </div>
                    <div className="mt-2 space-y-2">
                      {readiness.dependencies.filter((dependency) => dependency.status === "blocked").map((dependency) => (
                        <div key={dependency.id} className="rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-2">
                          <div className="text-[11px] text-foreground">{dependency.message}</div>
                          {dependency.fixHint && <div className="mt-1 text-[10px] text-muted-foreground">{dependency.fixHint}</div>}
                          {(dependency.resolverSection || dependency.resolverStepId) && <Button variant="outline" size="sm" className="mt-2 h-7 text-[11px]" onClick={() => onResolveDependency(dependency)}>Resolve</Button>}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
            {blockedComponents.map((component) => (
              <div key={component.instanceId} className="rounded-lg border border-border/20 bg-background/30 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-medium text-foreground">{component.label}</div>
                    <div className="text-[10px] text-muted-foreground">{component.componentType}</div>
                  </div>
                  <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={onInspectComponent}>Inspect</Button>
                </div>
                <div className="mt-2 space-y-2">
                  {component.dependencies.filter((dependency) => dependency.status === "blocked").map((dependency) => (
                    <div key={dependency.id} className="rounded-md border border-red-500/20 bg-red-500/5 px-2.5 py-2">
                      <div className="text-[11px] text-foreground">{dependency.message}</div>
                      {dependency.fixHint && <div className="mt-1 text-[10px] text-muted-foreground">{dependency.fixHint}</div>}
                      {(dependency.resolverSection || dependency.resolverStepId) && <Button variant="outline" size="sm" className="mt-2 h-7 text-[11px]" onClick={() => onResolveDependency(dependency)}>Resolve</Button>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/30 bg-muted/10 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-foreground">Partial Readiness</h4>
            <Badge variant="outline" className="border-amber-500/30 text-amber-400">{partialBindings.length + partialComponents.length}</Badge>
          </div>
          <div className="mt-3 space-y-2">
            {partialBindings.length === 0 && partialComponents.length === 0 ? (
              <div className="rounded-lg border border-border/20 bg-background/30 px-3 py-2 text-[11px] text-muted-foreground">No partial surfaces are waiting on publish setup.</div>
            ) : (
              <>
                {partialBindings.map((binding) => (
                  <button key={binding.bindingId} type="button" className="w-full rounded-lg border border-border/20 bg-background/30 px-3 py-2 text-left" onClick={() => onInspectBinding(binding.bindingId)}>
                    <div className="text-[11px] font-medium text-foreground">{binding.coreIntent || binding.intent}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{readinessReport.readiness[binding.bindingId]?.missingDependencies.join(", ") || "Needs publish setup"}</div>
                  </button>
                ))}
                {partialComponents.map((component) => (
                  <button key={component.instanceId} type="button" className="w-full rounded-lg border border-border/20 bg-background/30 px-3 py-2 text-left" onClick={onInspectComponent}>
                    <div className="text-[11px] font-medium text-foreground">{component.label}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{component.missingDependencies.join(", ") || "Needs publish setup"}</div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/30 bg-muted/10 p-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Structural Layer</h4>
          <Badge variant="outline" className={cn(summary.isHealthy ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400")}>{summary.isHealthy ? "Healthy" : "Needs Review"}</Badge>
        </div>
        <div className="mt-3 space-y-1.5">
          {validations.length === 0 ? (
            <p className="text-xs text-muted-foreground">No validation issues detected. The structure graph is consistent.</p>
          ) : (
            validations.map((validation) => (
              <div key={validation.id} className={cn(
                "flex items-start gap-2 p-2 rounded-md border text-xs",
                validation.severity === "error" ? "border-red-500/30 bg-red-500/5" : validation.severity === "warning" ? "border-amber-500/30 bg-amber-500/5" : "border-blue-500/30 bg-blue-500/5",
              )}>
                {severityIcon(validation.severity)}
                <div className="flex-1 min-w-0">
                  <div className="text-foreground">{validation.message}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 capitalize">{validation.scope}</Badge>
                    {validation.targetId && <span className="text-muted-foreground text-[9px] truncate">{validation.targetId}</span>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/30 bg-muted/10 px-3 py-2 text-xs">
      <div className="text-muted-foreground">{title}</div>
      <div className="mt-1 text-foreground">{value}</div>
    </div>
  );
}

function CatalogGraph({
  playground,
  vfsFiles,
  mode,
  onSelect,
  onNavigateToPage,
  selectedItemId,
}: {
  playground: UseCreatorPlaygroundReturn;
  vfsFiles: Record<string, string>;
  mode: "products" | "services";
  onSelect: (itemId: string) => void;
  onNavigateToPage?: (pageId: string) => void;
  selectedItemId: string | null;
}) {
  const topology = useMemo(
    () => buildCatalogTopology(playground.creatorData, playground.pageRegistry, vfsFiles),
    [playground.creatorData, playground.pageRegistry, vfsFiles],
  );

  const items = useMemo(() => {
    if (mode === "products") {
      return Object.values(playground.creatorData.products)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p) => ({ id: p.productId, name: p.name, meta: `${p.currency} ${p.price}`, featured: !!p.featured }));
    }
    return Object.values(playground.creatorData.services)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({ id: s.serviceId, name: s.name, meta: s.duration ? `${s.duration} min` : "", featured: !!s.featured }));
  }, [mode, playground.creatorData.products, playground.creatorData.services]);

  const edges = mode === "products"
    ? topology.productEdges.map((e) => ({ pageId: e.pageId, itemId: e.productId, kind: e.kind }))
    : topology.serviceEdges.map((e) => ({ pageId: e.pageId, itemId: e.serviceId, kind: e.kind }));

  const orphanIds = mode === "products" ? topology.orphanProductIds : topology.orphanServiceIds;
  const orphanSet = new Set(orphanIds);

  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dropPageId, setDropPageId] = useState<string | null>(null);
  const [lastBind, setLastBind] = useState<{ pageLabel: string; itemName: string } | null>(null);

  const handleDropOnPage = (pageId: string) => {
    if (!dragItemId) return;
    const item = items.find((i) => i.id === dragItemId);
    if (!item) return;
    const page = topology.pages.find((p) => p.pageId === pageId);
    if (!page) return;

    // Check if a direct-binding instance already exists on this page
    const existing = Object.values(playground.creatorData.componentInstances).find((ci) => {
      const matchesItem = mode === "products"
        ? ci.bindings?.productId === dragItemId
        : ci.bindings?.serviceId === dragItemId;
      return matchesItem && (ci.usedOnPages || []).includes(pageId);
    });

    if (!existing) {
      const componentType = mode === "products" ? "ProductGrid" : "ServiceGrid";
      const componentSlug = mode === "products" ? "product-grid" : "service-grid";
      const bindings = mode === "products"
        ? { productId: dragItemId }
        : { serviceId: dragItemId };

      playground.addComponentInstance({
        componentType,
        componentSlug,
        label: item.name,
        bindings,
        props: { title: item.name },
        usedOnPages: [pageId],
      });
    }

    setLastBind({ pageLabel: page.label, itemName: item.name });
    setDragItemId(null);
    setDropPageId(null);
    window.setTimeout(() => setLastBind(null), 2400);
  };

  if (items.length === 0) {
    return <div className="rounded-lg border border-dashed border-border/30 bg-muted/5 px-3 py-6 text-center text-xs text-muted-foreground">Nothing to graph yet.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold uppercase tracking-wide">Legend:</span>
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-emerald-500/70" /> direct</span>
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-amber-500/70" /> featured</span>
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-sky-500/70" /> collection</span>
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-violet-500/70" /> all</span>
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-4 bg-zinc-500/60" /> vfs static</span>
        </div>
        {dragItemId && (
          <span className="text-emerald-400">Drop onto a page to bind directly →</span>
        )}
        {lastBind && (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
            Bound “{lastBind.itemName}” → {lastBind.pageLabel}
          </span>
        )}
      </div>

      <div className="relative rounded-xl border border-border/30 bg-muted/5 p-4">
        <div className="grid grid-cols-2 gap-x-12 gap-y-2">
          {/* Pages column — drop targets */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Pages</div>
            {topology.pages.length === 0 && (
              <div className="text-[11px] text-muted-foreground/70">No pages.</div>
            )}
            {topology.pages.map((page) => {
              const incoming = edges.filter((e) => e.pageId === page.pageId);
              const isDropTarget = dragItemId && dropPageId === page.pageId;
              const isDragActive = !!dragItemId;
              return (
                <button
                  key={page.pageId}
                  type="button"
                  data-graph-node={`page:${page.pageId}`}
                  onClick={() => onNavigateToPage?.(page.pageId)}
                  onDragOver={(e) => {
                    if (!dragItemId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "link";
                    if (dropPageId !== page.pageId) setDropPageId(page.pageId);
                  }}
                  onDragLeave={() => {
                    if (dropPageId === page.pageId) setDropPageId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDropOnPage(page.pageId);
                  }}
                  className={cn(
                    "w-full text-left rounded-md border px-2.5 py-1.5 transition-colors",
                    isDropTarget
                      ? "border-emerald-500/60 bg-emerald-500/15 ring-1 ring-emerald-500/40"
                      : isDragActive
                        ? "border-dashed border-emerald-500/30 bg-background/40 hover:bg-emerald-500/5"
                        : "border-border/30 bg-background/40 hover:bg-muted/20",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-xs font-medium text-foreground">{page.label}</div>
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5">{incoming.length}</Badge>
                  </div>
                  {page.slug && <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{page.slug}</div>}
                </button>
              );
            })}
          </div>

          {/* Items column — draggable sources */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              {mode === "products" ? "Products" : "Services"}
            </div>
            {items.map((item) => {
              const outgoing = edges.filter((e) => e.itemId === item.id);
              const isOrphan = orphanSet.has(item.id);
              const isSelected = selectedItemId === item.id;
              const isDragging = dragItemId === item.id;
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    setDragItemId(item.id);
                    e.dataTransfer.effectAllowed = "link";
                    e.dataTransfer.setData("text/plain", item.id);
                  }}
                  onDragEnd={() => { setDragItemId(null); setDropPageId(null); }}
                  className={cn(
                    "group rounded-md border px-2.5 py-1.5 transition-colors cursor-grab active:cursor-grabbing",
                    isSelected ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/30 bg-background/40 hover:bg-muted/20",
                    isOrphan && "border-rose-500/30 bg-rose-500/5",
                    isDragging && "opacity-60 ring-1 ring-emerald-500/40",
                  )}
                >
                  <button
                    type="button"
                    data-graph-node={`item:${item.id}`}
                    onClick={() => onSelect(item.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <GripVertical className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground shrink-0" />
                        {item.featured && <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />}
                        <div className="truncate text-xs font-medium text-foreground">{item.name}</div>
                      </div>
                      {isOrphan ? (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-rose-500/40 text-rose-400">orphan</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-emerald-500/40 text-emerald-400">
                          <Link2 className="mr-0.5 h-2.5 w-2.5" />{outgoing.length}
                        </Badge>
                      )}
                    </div>
                    {item.meta && <div className="mt-0.5 text-[10px] text-muted-foreground">{item.meta}</div>}
                    {outgoing.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {outgoing.slice(0, 4).map((e, i) => (
                          <span
                            key={`${e.itemId}-${e.pageId}-${i}`}
                            className={cn(
                              "rounded px-1 py-px text-[9px] border",
                              e.kind === "direct" && "border-emerald-500/40 text-emerald-400",
                              e.kind === "featured" && "border-amber-500/40 text-amber-400",
                              e.kind === "collection" && "border-sky-500/40 text-sky-400",
                              e.kind === "all" && "border-violet-500/40 text-violet-400",
                              e.kind === "vfs_static" && "border-zinc-500/40 text-zinc-400",
                            )}
                          >
                            {e.kind}
                          </span>
                        ))}
                        {outgoing.length > 4 && (
                          <span className="text-[9px] text-muted-foreground">+{outgoing.length - 4}</span>
                        )}
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/20 pt-3 text-[11px] text-muted-foreground">
          <div>
            <strong className="text-foreground">{edges.length}</strong> connection{edges.length === 1 ? "" : "s"} ·{" "}
            <strong className="text-foreground">{orphanIds.length}</strong> orphan{orphanIds.length === 1 ? "" : "s"}
          </div>
          <div className="text-[10px]">Click to edit · drag an item onto a page to bind directly</div>
        </div>
      </div>
    </div>
  );
}

export default CreatorPlaygroundModal;
