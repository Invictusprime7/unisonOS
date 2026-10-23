/**
 * SetupWizardPanel — Full 7-step launch wizard for the Creator's Playground.
 * 
 * Each step renders an inline form that writes to the relevant backend tables.
 */

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { BusinessLogoInput } from "@/components/business/BusinessLogoInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Calendar, Bell, CreditCard, Database, Globe, Search, BarChart3,
  CheckCircle2, Circle, ChevronRight, Rocket, ArrowRight, ArrowLeft,
  Clock, Save, SkipForward, RotateCcw, Loader2, Shield, Zap,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UseSetupWizardReturn, SetupStepId, SetupStep } from "@/hooks/useSetupWizard";
import { loadSiteProfile, saveSiteProfile, type BusinessProfilePatch } from "@/services/businessProfileService";
import type { BusinessProfileDTO, WeekDay } from "@/types/businessProfile";

// ============================================================================
// Step Icon Map
// ============================================================================

const STEP_ICONS: Record<SetupStepId, React.ElementType> = {
  owner_information: UserRound,
  booking_calendar: Calendar,
  notifications: Bell,
  payments: CreditCard,
  database: Database,
  domain: Globe,
  seo: Search,
  analytics: BarChart3,
};

const STEP_COLORS: Record<SetupStepId, string> = {
  owner_information: "text-sky-400 bg-sky-500/15",
  booking_calendar: "text-orange-400 bg-orange-500/15",
  notifications: "text-violet-400 bg-violet-500/15",
  payments: "text-emerald-400 bg-emerald-500/15",
  database: "text-blue-400 bg-blue-500/15",
  domain: "text-cyan-400 bg-cyan-500/15",
  seo: "text-amber-400 bg-amber-500/15",
  analytics: "text-pink-400 bg-pink-500/15",
};

// ============================================================================
// Props
// ============================================================================

interface SetupWizardPanelProps {
  wizard: UseSetupWizardReturn;
  businessId: string | null;
  siteId: string | null;
  projectId: string | null;
  industry?: string | null;
  systemType?: string | null;
}

// ============================================================================
// Main Panel
// ============================================================================

export function SetupWizardPanel({ wizard, businessId, siteId, projectId, industry, systemType }: SetupWizardPanelProps) {
  const { steps, activeStep, setActiveStep, progressPercent, completedCount, totalCount, isLoading, isSaving } = wizard;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400 mr-3" />
        <span className="text-sm text-muted-foreground">Loading setup progress...</span>
      </div>
    );
  }

  if (!businessId || !siteId || !projectId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="h-10 w-10 text-muted-foreground/40 mb-4" />
        <h3 className="text-sm font-semibold text-foreground mb-1">No Confirmed Site Connected</h3>
        <p className="text-xs text-muted-foreground max-w-xs">
          Confirm a launch from the System Launcher first to create a durable site workspace and unlock live setup.
        </p>
      </div>
    );
  }

  // If a step is selected, show its detail view
  if (activeStep) {
    const step = steps.find(s => s.id === activeStep);
    if (step) {
      return (
        <StepDetailView
          step={step}
          wizard={wizard}
          businessId={businessId}
          projectId={projectId}
          industry={industry}
          systemType={systemType}
          onBack={() => setActiveStep(null)}
        />
      );
    }
  }

  // Overview list
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/20">
          <Rocket className="h-5 w-5 text-violet-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-foreground">Launch Setup Wizard</h2>
          <p className="text-[11px] text-muted-foreground">
            Complete these steps to go live with full functionality
          </p>
        </div>
        <Badge 
          variant="outline" 
          className={cn(
            "text-xs px-2.5 py-0.5",
            progressPercent === 100 
              ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10" 
              : "border-violet-500/40 text-violet-400 bg-violet-500/10"
          )}
        >
          {completedCount}/{totalCount}
        </Badge>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <Progress value={progressPercent} className="h-2 bg-muted/30" />
        <p className="text-[10px] text-muted-foreground text-right">{progressPercent}% complete</p>
      </div>

      {/* Steps List */}
      <div className="space-y-1.5">
        {/* Core steps */}
        <StepGroup label="Core Setup" steps={steps.filter(s => s.category === "core")} onSelect={setActiveStep} />
        <StepGroup label="Growth" steps={steps.filter(s => s.category === "growth")} onSelect={setActiveStep} />
        <StepGroup label="Advanced" steps={steps.filter(s => s.category === "advanced")} onSelect={setActiveStep} />
      </div>
    </div>
  );
}

// ============================================================================
// Step Group
// ============================================================================

function StepGroup({ label, steps, onSelect }: { label: string; steps: SetupStep[]; onSelect: (id: SetupStepId) => void }) {
  if (steps.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold px-1 pt-2">{label}</p>
      {steps.map(step => (
        <StepRow key={step.id} step={step} onSelect={() => onSelect(step.id)} />
      ))}
    </div>
  );
}

// ============================================================================
// Step Row
// ============================================================================

function StepRow({ step, onSelect }: { step: SetupStep; onSelect: () => void }) {
  const Icon = STEP_ICONS[step.id];
  const colorClass = STEP_COLORS[step.id];
  const isComplete = step.status === "completed";
  const isSkipped = step.status === "skipped";

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 rounded-lg border transition-all text-left group",
        isComplete
          ? "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10"
          : isSkipped
            ? "bg-muted/10 border-border/20 opacity-60 hover:opacity-100 hover:bg-muted/20"
            : "bg-muted/10 border-border/20 hover:bg-muted/30 hover:border-border/40"
      )}
    >
      <div className={cn("p-2 rounded-lg shrink-0", isComplete ? "bg-emerald-500/15" : colorClass)}>
        {isComplete ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium", isComplete && "text-emerald-400")}>{step.title}</span>
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-border/30">
            <Clock className="h-2.5 w-2.5 mr-0.5" />{step.timeEstimate}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{step.description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
    </button>
  );
}

// ============================================================================
// Step Detail View
// ============================================================================

function StepDetailView({ step, wizard, businessId, projectId, industry, systemType, onBack }: {
  step: SetupStep;
  wizard: UseSetupWizardReturn;
  businessId: string;
  projectId: string | null;
  industry?: string | null;
  systemType?: string | null;
  onBack: () => void;
}) {
  const Icon = STEP_ICONS[step.id];
  const isComplete = step.status === "completed";
  const [ownerInfoDirty, setOwnerInfoDirty] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border/20">
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className={cn("p-2 rounded-lg shrink-0", STEP_COLORS[step.id])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-foreground">{step.title}</h3>
          <p className="text-[11px] text-muted-foreground">{step.description}</p>
        </div>
        {isComplete && (
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
          </Badge>
        )}
      </div>

      {/* Form Content */}
      <ScrollArea className="flex-1 py-4">
        <StepForm step={step} wizard={wizard} businessId={businessId} projectId={projectId} industry={industry} systemType={systemType} onOwnerInfoDirtyChange={setOwnerInfoDirty} />
      </ScrollArea>

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border/20">
        <div className="flex gap-2">
          {step.status !== "pending" && (
            <Button variant="ghost" size="sm" onClick={() => wizard.resetStep(step.id)} className="text-xs h-8">
              <RotateCcw className="h-3 w-3 mr-1" /> Reset
            </Button>
          )}
          {step.status !== "skipped" && step.status !== "completed" && (
            <Button variant="ghost" size="sm" onClick={() => wizard.skipStep(step.id)} className="text-xs h-8 text-muted-foreground">
              <SkipForward className="h-3 w-3 mr-1" /> Skip
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => wizard.saveStepConfig(step.id)} disabled={wizard.isSaving} className="text-xs h-8">
            <Save className="h-3 w-3 mr-1" /> Save Draft
          </Button>
          <Button 
            size="sm" 
            onClick={() => wizard.completeStep(step.id)} 
            disabled={wizard.isSaving || (step.id === "owner_information" && ownerInfoDirty)}
            title={step.id === "owner_information" && ownerInfoDirty ? "Save owner information before completing this step" : undefined}
            className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700"
          >
            {wizard.isSaving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
            Mark Complete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Step-Specific Forms
// ============================================================================

function StepForm({ step, wizard, businessId, projectId, industry, systemType, onOwnerInfoDirtyChange }: {
  step: SetupStep;
  wizard: UseSetupWizardReturn;
  businessId: string;
  projectId: string | null;
  industry?: string | null;
  systemType?: string | null;
  onOwnerInfoDirtyChange: (dirty: boolean) => void;
}) {
  switch (step.id) {
    case "owner_information": return <OwnerInformationForm businessId={businessId} projectId={projectId} industry={industry} systemType={systemType} onDirtyChange={onOwnerInfoDirtyChange} />;
    case "booking_calendar": return <BookingCalendarForm step={step} wizard={wizard} />;
    case "notifications": return <NotificationsForm step={step} wizard={wizard} />;
    case "payments": return <PaymentsForm step={step} wizard={wizard} />;
    case "database": return <DatabaseForm step={step} wizard={wizard} />;
    case "domain": return <DomainForm step={step} wizard={wizard} />;
    case "seo": return <SEOForm step={step} wizard={wizard} />;
    case "analytics": return <AnalyticsForm step={step} wizard={wizard} />;
    default: return null;
  }
}

function OwnerInformationForm({
  businessId,
  projectId,
  industry,
  systemType,
  onDirtyChange,
}: {
  businessId: string;
  projectId: string | null;
  industry?: string | null;
  systemType?: string | null;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [profile, setProfile] = useState<BusinessProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadSiteProfile(businessId, projectId).then((loaded) => {
      if (cancelled) return;
      setProfile(loaded);
      setError(loaded ? null : 'Owner information could not be loaded for this site.');
    }).catch((loadError) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Owner information could not be loaded.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [businessId, projectId]);

  const edit = (patch: Partial<BusinessProfileDTO>) => {
    setProfile((current) => current ? { ...current, ...patch } : current);
    setDirty(true);
    setSaved(false);
    onDirtyChange(true);
    setError(null);
  };

  const save = async () => {
    if (!profile || !projectId) {
      setError('A confirmed site project is required to save owner information.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const patch: BusinessProfilePatch = {
        name: profile.name.trim(),
        notificationEmail: profile.notificationEmail?.trim() || null,
        notificationPhone: profile.notificationPhone?.trim() || null,
        email: profile.email?.trim() || null,
        phone: profile.phone?.trim() || null,
        website: profile.website?.trim() || null,
        tagline: profile.tagline?.trim() || null,
        description: profile.description?.trim() || null,
        logoUrl: profile.logoUrl?.trim() || null,
        brandColor: profile.brandColor?.trim() || null,
        timezone: profile.timezone?.trim() || 'UTC',
        address: profile.address,
        hours: profile.hours,
        socialLinks: profile.socialLinks,
      };
      const savedProfile = await saveSiteProfile(businessId, projectId, patch);
      if (!savedProfile) throw new Error('Owner information could not be saved.');
      setProfile(savedProfile);
      setDirty(false);
      setSaved(true);
      onDirtyChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Owner information could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading owner profile...</div>;
  }
  if (!profile) return <p role="alert" className="py-6 text-sm text-destructive">{error || 'Owner information is unavailable.'}</p>;

  const localIndustries = new Set(['salon', 'barber', 'medspa', 'wellness', 'dental', 'fitness', 'local-service', 'contractor', 'hvac', 'cleaning', 'landscaping', 'auto-detailing', 'moving', 'restaurant', 'cafe', 'bakery', 'real-estate']);
  const localBusiness = !industry || localIndustries.has(industry.toLowerCase().replace(/[_\s]+/g, '-'));
  const showHours = localBusiness || systemType === 'booking';
  const days: Array<{ id: WeekDay; label: string }> = [
    { id: 'mon', label: 'Monday' }, { id: 'tue', label: 'Tuesday' }, { id: 'wed', label: 'Wednesday' },
    { id: 'thu', label: 'Thursday' }, { id: 'fri', label: 'Friday' }, { id: 'sat', label: 'Saturday' }, { id: 'sun', label: 'Sunday' },
  ];

  return (
    <div className="space-y-5">
      <FormSection title="Contact details">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label className="text-xs">Business name</Label><Input aria-label="Business name" value={profile.name} onChange={(event) => edit({ name: event.target.value })} className="mt-1 h-9 text-sm" /></div>
          <div><Label className="text-xs">Owner email for notifications</Label><Input aria-label="Owner email for notifications" type="email" value={profile.notificationEmail || ''} onChange={(event) => edit({ notificationEmail: event.target.value })} className="mt-1 h-9 text-sm" /></div>
          <div><Label className="text-xs">Public email</Label><Input aria-label="Public email" type="email" value={profile.email || ''} onChange={(event) => edit({ email: event.target.value })} className="mt-1 h-9 text-sm" /></div>
          <div><Label className="text-xs">Public phone</Label><Input aria-label="Public phone" type="tel" value={profile.phone || ''} onChange={(event) => edit({ phone: event.target.value })} className="mt-1 h-9 text-sm" /></div>
          <div><Label className="text-xs">Website</Label><Input aria-label="Website" type="url" value={profile.website || ''} onChange={(event) => edit({ website: event.target.value })} className="mt-1 h-9 text-sm" /></div>
        </div>
      </FormSection>

      <details className="group rounded-md border border-border/50 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium">Brand details</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><Label className="text-xs">Tagline</Label><Input aria-label="Tagline" value={profile.tagline || ''} onChange={(event) => edit({ tagline: event.target.value })} className="mt-1 h-9 text-sm" /></div>
          <div><Label className="text-xs">Brand color</Label><Input aria-label="Brand color" type="color" value={profile.brandColor || '#111827'} onChange={(event) => edit({ brandColor: event.target.value })} className="mt-1 h-9 p-1" /></div>
          <div className="sm:col-span-2"><Label className="text-xs">Logo</Label><div className="mt-1"><BusinessLogoInput value={profile.logoUrl} scopeId={projectId} onChange={(logoUrl) => edit({ logoUrl })} compact /></div></div>
          <div className="sm:col-span-2"><Label className="text-xs">About</Label><Textarea aria-label="About" value={profile.description || ''} onChange={(event) => edit({ description: event.target.value })} rows={3} className="mt-1 text-sm" /></div>
          <div><Label className="text-xs">Notification phone</Label><Input aria-label="Notification phone" type="tel" value={profile.notificationPhone || ''} onChange={(event) => edit({ notificationPhone: event.target.value })} className="mt-1 h-9 text-sm" /></div>
        </div>
      </details>

      {localBusiness && <details className="group rounded-md border border-border/50 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium">Location and hours</summary>
        <div className="mt-3 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label className="text-xs">Street address</Label><Input aria-label="Street address" value={profile.address.line1 || ''} onChange={(event) => edit({ address: { ...profile.address, line1: event.target.value } })} className="mt-1 h-9 text-sm" /></div>
          <div><Label className="text-xs">City</Label><Input aria-label="City" value={profile.address.city || ''} onChange={(event) => edit({ address: { ...profile.address, city: event.target.value } })} className="mt-1 h-9 text-sm" /></div>
          <div><Label className="text-xs">State or region</Label><Input aria-label="State or region" value={profile.address.region || ''} onChange={(event) => edit({ address: { ...profile.address, region: event.target.value } })} className="mt-1 h-9 text-sm" /></div>
          <div><Label className="text-xs">Postal code</Label><Input aria-label="Postal code" value={profile.address.postalCode || ''} onChange={(event) => edit({ address: { ...profile.address, postalCode: event.target.value } })} className="mt-1 h-9 text-sm" /></div>
          <div><Label className="text-xs">Country</Label><Input aria-label="Country" value={profile.address.country || ''} onChange={(event) => edit({ address: { ...profile.address, country: event.target.value } })} className="mt-1 h-9 text-sm" /></div>
        </div>

      {showHours && <div>
        <p className="mb-2 text-xs font-semibold">Visitor-facing hours</p>
        <div className="space-y-2">
          {days.map(({ id, label }) => {
            const current = profile.hours.find((entry) => entry.day === id);
            const updateHours = (patch: Partial<BusinessProfileDTO['hours'][number]>) => {
              const next = profile.hours.filter((entry) => entry.day !== id);
              const updated = { day: id, ...current, ...patch };
              if (updated.closed || updated.open || updated.close) next.push(updated);
              edit({ hours: next });
            };
            return <div key={id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
              <span className="text-xs">{label}</span>
              <Input aria-label={`${label} open`} type="time" value={current?.open || ''} disabled={current?.closed} onChange={(event) => updateHours({ open: event.target.value, closed: false })} className="h-8 w-28" />
              <Input aria-label={`${label} close`} type="time" value={current?.close || ''} disabled={current?.closed} onChange={(event) => updateHours({ close: event.target.value, closed: false })} className="h-8 w-28" />
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground"><input type="checkbox" aria-label={`${label} closed`} checked={current?.closed || false} onChange={(event) => updateHours({ closed: event.target.checked, open: event.target.checked ? undefined : current?.open, close: event.target.checked ? undefined : current?.close })} />Closed</label>
            </div>;
          })}
        </div>
        <div className="mt-3 max-w-xs"><Label className="text-xs">Time zone</Label><Input aria-label="Time zone" value={profile.timezone} onChange={(event) => edit({ timezone: event.target.value })} placeholder="America/New_York" className="mt-1 h-9 text-sm" /></div>
      </div>}
        </div>
      </details>}

      <details className="group rounded-md border border-border/50 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium">Social profiles</summary>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['instagram', 'facebook', 'x', 'tiktok', 'linkedin', 'youtube', 'website'] as const).map((platform) => <div key={platform}><Label className="text-xs capitalize">{platform}</Label><Input type="url" value={profile.socialLinks[platform] || ''} onChange={(event) => edit({ socialLinks: { ...profile.socialLinks, [platform]: event.target.value } })} className="mt-1 h-9 text-sm" /></div>)}
        </div>
      </details>

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {saved && !dirty && <p role="status" className="text-xs text-emerald-400">Owner information saved.</p>}
      <Button size="sm" onClick={() => void save()} disabled={!dirty || saving} className="h-8">
        {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
        Save owner information
      </Button>
    </div>
  );
}

// ---------- Booking Calendar ----------
function BookingCalendarForm({ step, wizard }: { step: SetupStep; wizard: UseSetupWizardReturn }) {
  const config = step.config;
  const update = (k: string, v: unknown) => wizard.updateStepConfig("booking_calendar", { [k]: v });

  return (
    <div className="space-y-4">
      <FormSection title="Business Hours">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Opens At</Label>
            <Input type="time" value={(config.opensAt as string) || "09:00"} onChange={e => update("opensAt", e.target.value)} className="h-8 text-xs mt-1" />
          </div>
          <div>
            <Label className="text-xs">Closes At</Label>
            <Input type="time" value={(config.closesAt as string) || "17:00"} onChange={e => update("closesAt", e.target.value)} className="h-8 text-xs mt-1" />
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
            const days = (config.businessDays as number[]) || [1, 2, 3, 4, 5];
            const isActive = days.includes(i + 1);
            return (
              <Button
                key={day}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className={cn("h-7 px-2.5 text-[10px]", isActive && "bg-emerald-600 hover:bg-emerald-700")}
                onClick={() => {
                  const next = isActive ? days.filter(d => d !== i + 1) : [...days, i + 1].sort();
                  update("businessDays", next);
                }}
              >
                {day}
              </Button>
            );
          })}
        </div>
      </FormSection>

      <FormSection title="Booking Settings">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Default Duration (min)</Label>
            <Input type="number" value={(config.defaultDuration as number) || 30} onChange={e => update("defaultDuration", parseInt(e.target.value))} className="h-8 text-xs mt-1" min={15} step={15} />
          </div>
          <div>
            <Label className="text-xs">Buffer Time (min)</Label>
            <Input type="number" value={(config.bufferMinutes as number) || 15} onChange={e => update("bufferMinutes", parseInt(e.target.value))} className="h-8 text-xs mt-1" min={0} step={5} />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 p-2 rounded-lg bg-muted/20">
          <div>
            <Label className="text-xs font-medium">Allow Same-Day Booking</Label>
            <p className="text-[10px] text-muted-foreground">Let customers book appointments today</p>
          </div>
          <Switch checked={(config.sameDayBooking as boolean) ?? true} onCheckedChange={v => update("sameDayBooking", v)} />
        </div>
      </FormSection>

      <FormSection title="Services">
        <p className="text-[11px] text-muted-foreground">
          Add and manage your bookable services in the Services tab of the Creator's Playground.
        </p>
      </FormSection>
    </div>
  );
}

// ---------- Notifications ----------
function NotificationsForm({ step, wizard }: { step: SetupStep; wizard: UseSetupWizardReturn }) {
  const config = step.config;
  const update = (k: string, v: unknown) => wizard.updateStepConfig("notifications", { [k]: v });

  return (
    <div className="space-y-4">
      <FormSection title="Email Notifications">
        <div>
          <Label className="text-xs">Notification Email</Label>
          <Input type="email" value={(config.notificationEmail as string) || ""} onChange={e => update("notificationEmail", e.target.value)} placeholder="owner@business.com" className="h-8 text-xs mt-1" />
          <p className="text-[10px] text-muted-foreground mt-1">New leads, bookings, and form submissions will be sent here</p>
        </div>
        <div className="space-y-2 mt-3">
          {[
            { key: "emailNewLead", label: "New lead captured", desc: "When someone submits a contact form" },
            { key: "emailNewBooking", label: "New booking created", desc: "When a customer books an appointment" },
            { key: "emailBookingReminder", label: "Booking reminders", desc: "Remind customers 24h before their appointment" },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
              <div>
                <Label className="text-xs font-medium">{item.label}</Label>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={(config[item.key] as boolean) ?? true} onCheckedChange={v => update(item.key, v)} />
            </div>
          ))}
        </div>
      </FormSection>

      <FormSection title="SMS Notifications">
        <div>
          <Label className="text-xs">SMS Phone Number</Label>
          <Input type="tel" value={(config.smsPhone as string) || ""} onChange={e => update("smsPhone", e.target.value)} placeholder="+1 (555) 000-0000" className="h-8 text-xs mt-1" />
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 mt-3">
          <div>
            <Label className="text-xs font-medium">Enable SMS Reminders</Label>
            <p className="text-[10px] text-muted-foreground">Send text message reminders to customers</p>
          </div>
          <Switch checked={(config.smsEnabled as boolean) ?? false} onCheckedChange={v => update("smsEnabled", v)} />
        </div>
      </FormSection>
    </div>
  );
}

// ---------- Payments ----------
function PaymentsForm({ step, wizard }: { step: SetupStep; wizard: UseSetupWizardReturn }) {
  const config = step.config;
  const update = (k: string, v: unknown) => wizard.updateStepConfig("payments", { [k]: v });

  return (
    <div className="space-y-4">
      <FormSection title="Stripe Integration">
        <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">Stripe Connect</span>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            Connect your Stripe account to accept credit cards, Apple Pay, and Google Pay.
          </p>
          <Button variant="outline" size="sm" className="text-xs h-8 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
            <CreditCard className="h-3 w-3 mr-1.5" />
            {config.stripeConnected ? "Reconnect Stripe" : "Connect Stripe Account"}
          </Button>
        </div>
      </FormSection>

      <FormSection title="Payment Settings">
        <div>
          <Label className="text-xs">Currency</Label>
          <Select value={(config.currency as string) || "usd"} onValueChange={v => update("currency", v)}>
            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="usd" className="text-xs">USD ($)</SelectItem>
              <SelectItem value="eur" className="text-xs">EUR (€)</SelectItem>
              <SelectItem value="gbp" className="text-xs">GBP (£)</SelectItem>
              <SelectItem value="cad" className="text-xs">CAD (C$)</SelectItem>
              <SelectItem value="aud" className="text-xs">AUD (A$)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 mt-3">
          <div>
            <Label className="text-xs font-medium">Require Deposits</Label>
            <p className="text-[10px] text-muted-foreground">Collect a deposit at booking time</p>
          </div>
          <Switch checked={(config.requireDeposit as boolean) ?? false} onCheckedChange={v => update("requireDeposit", v)} />
        </div>
        {config.requireDeposit && (
          <div className="mt-2">
            <Label className="text-xs">Deposit Amount (%)</Label>
            <Input type="number" value={(config.depositPercent as number) || 25} onChange={e => update("depositPercent", parseInt(e.target.value))} className="h-8 text-xs mt-1" min={1} max={100} />
          </div>
        )}
      </FormSection>
    </div>
  );
}

// ---------- Database ----------
function DatabaseForm({ step, wizard }: { step: SetupStep; wizard: UseSetupWizardReturn }) {
  return (
    <div className="space-y-4">
      <FormSection title="Database Status">
        <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-emerald-500/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-400">Connected via Supabase</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Your database is automatically provisioned and managed. Form submissions, bookings, and leads are stored securely.
              </p>
            </div>
          </div>
        </div>
      </FormSection>

      <FormSection title="Active Tables">
        <div className="space-y-1.5">
          {["leads", "bookings", "services", "orders", "crm_contacts"].map(table => (
            <div key={table} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/15">
              <Database className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-xs font-mono text-foreground">{table}</span>
              <Badge variant="outline" className="ml-auto text-[9px] h-4 px-1.5 text-emerald-400 border-emerald-500/30">active</Badge>
            </div>
          ))}
        </div>
      </FormSection>
    </div>
  );
}

// ---------- Domain ----------
function DomainForm({ step, wizard }: { step: SetupStep; wizard: UseSetupWizardReturn }) {
  const config = step.config;
  const update = (k: string, v: unknown) => wizard.updateStepConfig("domain", { [k]: v });

  return (
    <div className="space-y-4">
      <FormSection title="Custom Domain">
        <div>
          <Label className="text-xs">Domain Name</Label>
          <Input value={(config.domainName as string) || ""} onChange={e => update("domainName", e.target.value)} placeholder="www.yourbusiness.com" className="h-8 text-xs mt-1" />
        </div>
        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 mt-3">
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">DNS Configuration:</strong> Point your domain's A record to <code className="text-xs bg-muted/40 px-1 py-0.5 rounded">185.158.133.1</code> and add a TXT record with your verification code.
          </p>
        </div>
      </FormSection>

      <FormSection title="SSL Certificate">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <Shield className="h-4 w-4 text-emerald-400" />
          <div>
            <p className="text-xs font-medium text-emerald-400">Auto-Provisioned</p>
            <p className="text-[10px] text-muted-foreground">SSL certificates are automatically generated once your domain is verified</p>
          </div>
        </div>
      </FormSection>
    </div>
  );
}

// ---------- SEO ----------
function SEOForm({ step, wizard }: { step: SetupStep; wizard: UseSetupWizardReturn }) {
  const config = step.config;
  const update = (k: string, v: unknown) => wizard.updateStepConfig("seo", { [k]: v });

  return (
    <div className="space-y-4">
      <FormSection title="Meta Tags">
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Site Title</Label>
            <Input value={(config.siteTitle as string) || ""} onChange={e => update("siteTitle", e.target.value)} placeholder="Your Business Name" className="h-8 text-xs mt-1" maxLength={60} />
            <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{((config.siteTitle as string) || "").length}/60</p>
          </div>
          <div>
            <Label className="text-xs">Meta Description</Label>
            <Textarea value={(config.siteDescription as string) || ""} onChange={e => update("siteDescription", e.target.value)} placeholder="Brief description of your business..." className="text-xs min-h-[60px] mt-1" maxLength={160} />
            <p className="text-[10px] text-muted-foreground mt-0.5 text-right">{((config.siteDescription as string) || "").length}/160</p>
          </div>
          <div>
            <Label className="text-xs">Keywords</Label>
            <Input value={(config.keywords as string) || ""} onChange={e => update("keywords", e.target.value)} placeholder="keyword1, keyword2, keyword3" className="h-8 text-xs mt-1" />
          </div>
        </div>
      </FormSection>

      <FormSection title="Open Graph">
        <div className="space-y-3">
          <div>
            <Label className="text-xs">OG Image URL</Label>
            <Input value={(config.ogImageUrl as string) || ""} onChange={e => update("ogImageUrl", e.target.value)} placeholder="https://..." className="h-8 text-xs mt-1" />
          </div>
          <div>
            <Label className="text-xs">Twitter Handle</Label>
            <Input value={(config.twitterHandle as string) || ""} onChange={e => update("twitterHandle", e.target.value)} placeholder="@yourbrand" className="h-8 text-xs mt-1" />
          </div>
        </div>
      </FormSection>
    </div>
  );
}

// ---------- Analytics ----------
function AnalyticsForm({ step, wizard }: { step: SetupStep; wizard: UseSetupWizardReturn }) {
  const config = step.config;
  const update = (k: string, v: unknown) => wizard.updateStepConfig("analytics", { [k]: v });

  return (
    <div className="space-y-4">
      <FormSection title="Google Analytics">
        <div>
          <Label className="text-xs">Measurement ID</Label>
          <Input value={(config.gaId as string) || ""} onChange={e => update("gaId", e.target.value)} placeholder="G-XXXXXXXXXX" className="h-8 text-xs mt-1" />
          <p className="text-[10px] text-muted-foreground mt-1">
            Find this in your Google Analytics property settings
          </p>
        </div>
      </FormSection>

      <FormSection title="Tracking Options">
        <div className="space-y-2">
          {[
            { key: "trackPageViews", label: "Page Views", desc: "Track every page visit automatically" },
            { key: "trackFormSubmissions", label: "Form Submissions", desc: "Fire events when forms are submitted" },
            { key: "trackButtonClicks", label: "CTA Clicks", desc: "Track clicks on call-to-action buttons" },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
              <div>
                <Label className="text-xs font-medium">{item.label}</Label>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={(config[item.key] as boolean) ?? true} onCheckedChange={v => update(item.key, v)} />
            </div>
          ))}
        </div>
      </FormSection>

      <FormSection title="Facebook Pixel">
        <div>
          <Label className="text-xs">Pixel ID</Label>
          <Input value={(config.fbPixelId as string) || ""} onChange={e => update("fbPixelId", e.target.value)} placeholder="123456789" className="h-8 text-xs mt-1" />
        </div>
      </FormSection>
    </div>
  );
}

// ============================================================================
// Shared UI
// ============================================================================

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-foreground mb-2.5 flex items-center gap-1.5">
        <div className="w-1 h-3 rounded-full bg-emerald-500/60" />
        {title}
      </h4>
      <div className="pl-3 border-l border-border/15 space-y-2">
        {children}
      </div>
    </div>
  );
}
