import { useState, useEffect } from "react";
import { supabase as _sb } from "@/integrations/supabase/client";
const supabase: any = _sb;
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, 
  Clock, 
  Bell, 
  Shield, 
  Zap, 
  Package,
  Check,
  X,
  Loader2,
  MoonStar,
  Mail,
  Phone,
  MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { applyCapabilityMigration } from "@/services/capabilityMigrationRunner";
import { CAPABILITY_PACKS, resolveCapabilityPacks, type BusinessCapability } from "@/platform/core/capabilityPacks";
import { loadInstalledSiteCapabilities, resolveSystemInstallCapabilityPacks, resolveSystemTypeCapabilityPacks } from "@/services/crmWorkspaceCapabilities";

interface AutomationSettings {
  id?: string;
  business_id: string;
  // Business Hours
  business_hours_enabled: boolean;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
  timezone: string;
  // Quiet Hours
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  // Rate Limiting
  max_messages_per_contact_per_day: number;
  dedupe_window_minutes: number;
  // Sender Identity
  default_sender_name: string;
  default_sender_email: string;
  default_sender_phone: string;
  // Compliance
  require_consent_for_sms: boolean;
  require_consent_for_email: boolean;
  honor_stop_keywords: boolean;
  // Global Toggle
  automations_enabled: boolean;
}

interface RecipePack {
  pack_id: string;
  name: string;
  description: string;
  industry: string;
  icon: string;
  tier: string;
  recipes: Array<{
    id: string;
    name: string;
    description: string;
    trigger: string;
  }>;
}

interface RecipeToggle {
  recipe_id: string;
  enabled: boolean;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const INDUSTRY_SYSTEM_TYPES: Record<string, string> = {
  salon: "booking",
  restaurant: "booking",
  contractor: "booking",
  agency: "agency",
  startup: "saas",
  ecommerce: "store",
  blog: "content",
  landing: "content",
  portfolio: "portfolio",
  general: "agency",
};

const SITE_CAPABILITY_PACKS = [
  ...CAPABILITY_PACKS.filter((pack) => pack.id === "crm.leads"),
  ...CAPABILITY_PACKS.filter((pack) => pack.id !== "business_profile" && pack.id !== "crm.leads"),
];

const DEFAULT_SETTINGS: AutomationSettings = {
  business_id: "",
  business_hours_enabled: false,
  business_hours_start: "09:00",
  business_hours_end: "17:00",
  business_days: [1, 2, 3, 4, 5],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  quiet_hours_enabled: true,
  quiet_hours_start: "21:00",
  quiet_hours_end: "08:00",
  max_messages_per_contact_per_day: 5,
  dedupe_window_minutes: 60,
  default_sender_name: "",
  default_sender_email: "",
  default_sender_phone: "",
  require_consent_for_sms: true,
  require_consent_for_email: false,
  honor_stop_keywords: true,
  automations_enabled: true,
};

interface BusinessAutomationSettingsProps {
  businessId: string;
  businessIndustry?: string;
  projectId: string;
  siteId: string | null;
  siteProjects: Array<{ id: string; name: string }>;
  onSelectProject: (projectId: string) => void;
}

export function BusinessAutomationSettings({
  businessId,
  businessIndustry,
  projectId,
  siteId,
  siteProjects,
  onSelectProject,
}: BusinessAutomationSettingsProps) {
  const [settings, setSettings] = useState<AutomationSettings>({ ...DEFAULT_SETTINGS, business_id: businessId });
  const [recipePacks, setRecipePacks] = useState<RecipePack[]>([]);
  const [recipeToggles, setRecipeToggles] = useState<Record<string, boolean>>({});
  const [installedPacks, setInstalledPacks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installingPackId, setInstallingPackId] = useState<string | null>(null);
  const [installResult, setInstallResult] = useState<{ packId: string; data: any } | null>(null);
  const [installedSiteCapabilities, setInstalledSiteCapabilities] = useState<BusinessCapability[]>([]);
  const [installingCapabilityId, setInstallingCapabilityId] = useState<BusinessCapability | null>(null);

  function getSystemType(industry: string): string {
    return INDUSTRY_SYSTEM_TYPES[industry] || "agency";
  }

  async function syncSiteCapabilities(pack: RecipePack) {
    if (!projectId || !siteId) {
      toast.error("Select a project with a linked site before installing a pack.");
      return;
    }

    try {
      setInstallingPackId(pack.pack_id);
      const capabilityPacks = resolveSystemTypeCapabilityPacks(getSystemType(pack.industry));
      const result = await applyCapabilityMigration({
        packs: capabilityPacks,
        businessId,
        projectId,
        siteId,
        summary: `Sync ${pack.name} capabilities to this project site.`,
      });
      if (!result.success) {
        toast.error(`Site capability sync failed: ${result.error || "Unknown error"}`);
        return;
      }
      toast.success(`${pack.name} site capabilities are up to date.`);
    } catch (err) {
      console.error("[syncSiteCapabilities] Error:", err);
      toast.error(`Site capability sync failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setInstallingPackId(null);
    }
  }

  useEffect(() => {
    loadSettings();
    loadRecipePacks();
  }, [businessId]);

  useEffect(() => {
    void refreshSiteCapabilities();
  }, [businessId, projectId, siteId]);

  async function refreshSiteCapabilities() {
    if (!businessId || !projectId) {
      setInstalledSiteCapabilities([]);
      return;
    }
    try {
      const installed = await loadInstalledSiteCapabilities({
        businessId,
        projectId,
        siteId: siteId ?? undefined,
      });
      setInstalledSiteCapabilities(installed);
    } catch (err) {
      console.error("[BusinessAutomationSettings] Failed to load site capabilities:", err);
      setInstalledSiteCapabilities([]);
    }
  }

  async function installSiteCapability(packId: BusinessCapability) {
    if (!businessId || !projectId || !siteId) {
      toast.error("Select a project with a linked site before installing capabilities.");
      return;
    }

    const pack = SITE_CAPABILITY_PACKS.find((candidate) => candidate.id === packId);
    if (!pack) return;

    try {
      setInstallingCapabilityId(packId);
      const resolved = resolveCapabilityPacks([packId]);
      const result = await applyCapabilityMigration({
        packs: resolved.order,
        businessId,
        projectId,
        siteId,
        summary: `Install the ${pack.name} capability for this project site.`,
      });
      if (!result.success) {
        toast.error(`Capability install failed: ${result.error || "Unknown error"}`);
        return;
      }
      await refreshSiteCapabilities();
      toast.success(`${pack.name} is enabled for this site.`);
    } catch (err) {
      console.error("[installSiteCapability] Error:", err);
      toast.error(`Capability install failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setInstallingCapabilityId(null);
    }
  }

  async function loadSettings() {
    try {
      const { data, error } = await supabase
        .from("business_automation_settings")
        .select("*")
        .eq("business_id", businessId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error loading settings:", error);
        toast.error("Failed to load automation settings");
        return;
      }

      if (data) {
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      } else {
        setSettings({ ...DEFAULT_SETTINGS, business_id: businessId });
      }

      // Load recipe toggles
      const { data: toggles } = await supabase
        .from("business_recipe_toggles")
        .select("recipe_id, enabled")
        .eq("business_id", businessId);

      if (toggles) {
        const toggleMap: Record<string, boolean> = {};
        toggles.forEach((t: RecipeToggle) => {
          toggleMap[t.recipe_id] = t.enabled;
        });
        setRecipeToggles(toggleMap);
      }

      // Load installed packs
      const { data: installed } = await supabase
        .from("installed_recipe_packs")
        .select("pack_id")
        .eq("business_id", businessId)
        .eq("enabled", true);

      if (installed) {
        setInstalledPacks(installed.map((p: { pack_id: string }) => p.pack_id));
      }
    } catch (err) {
      console.error("Error loading automation settings:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecipePacks() {
    try {
      const { data, error } = await supabase
        .from("automation_recipe_packs")
        .select("*")
        .eq("is_published", true)
        .order("industry", { ascending: true });

      if (error) throw error;

      // Parse recipes from JSONB
      const packs = (data || []).map((p: any) => ({
        ...p,
        recipes: typeof p.recipes === "string" ? JSON.parse(p.recipes) : p.recipes,
      }));

      setRecipePacks(packs);
    } catch (err) {
      console.error("Error loading recipe packs:", err);
    }
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("business_automation_settings")
        .upsert({
          ...settings,
          business_id: businessId,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      toast.success("Automation settings saved");
    } catch (err) {
      console.error("Error saving settings:", err);
      const errorMessage = err && typeof err === "object" && "message" in err
        ? String(err.message)
        : "Unknown error";
      toast.error(`Failed to save settings: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleRecipe(recipeId: string, enabled: boolean) {
    try {
      const { error } = await supabase
        .from("business_recipe_toggles")
        .upsert({
          business_id: businessId,
          recipe_id: recipeId,
          enabled,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setRecipeToggles((prev) => ({ ...prev, [recipeId]: enabled }));
      toast.success(enabled ? "Recipe enabled" : "Recipe disabled");
    } catch (err) {
      console.error("Error toggling recipe:", err);
      toast.error("Failed to update recipe");
    }
  }

  async function installPack(packId: string) {
    const pack = recipePacks.find(p => p.pack_id === packId);
    if (!pack) {
      toast.error("Pack not found");
      return;
    }
    if (!projectId || !siteId) {
      toast.error("Select a project with a linked site before installing a pack.");
      return;
    }

    try {
      setSaving(true);
      setInstallingPackId(packId);
      setInstallResult(null);
      
      // Map industry to system type for install-system
      const systemType = getSystemType(pack.industry);
      
      console.log("[installPack] Starting installation for pack:", packId, "system:", systemType);
      
      // Call install-system to properly set up all dependencies
      const { data: installData, error: installError } = await supabase.functions.invoke('install-system', {
        body: {
          systemType,
          businessId, // Pass the existing businessId
          businessName: pack.name,
          templateCategory: pack.industry,
        }
      });
      
      if (installError) {
        console.error("[installPack] Error calling install-system:", installError);

        let detailedMessage = installError.message;
        const maybeContext = (installError as { context?: Response }).context;
        if (maybeContext) {
          try {
            const contextBody = await maybeContext.clone().json();
            const apiError = typeof contextBody?.error === 'string' ? contextBody.error : null;
            detailedMessage = apiError
              ? `${apiError} (status ${maybeContext.status})`
              : `${installError.message} (status ${maybeContext.status})`;
          } catch {
            detailedMessage = `${installError.message} (status ${maybeContext.status})`;
          }
        }

        toast.error(`Installation failed: ${detailedMessage}`);
        return;
      }
      
      console.log("[installPack] System installed successfully:", installData);

      const resultData = installData?.data || installData;
      const backendPacks = Array.isArray(resultData?.packs)
        ? resultData.packs.filter((value: unknown): value is string => typeof value === "string")
        : [];
      const capabilityPacks = resolveSystemInstallCapabilityPacks(backendPacks);
      if (capabilityPacks.length === 0) {
        toast.error("Backend setup completed, but it returned no supported site capability packs.");
        return;
      }

      const capabilityInstall = await applyCapabilityMigration({
        packs: capabilityPacks,
        businessId,
        projectId,
        siteId,
        summary: `Install ${pack.name} capabilities for this project site.`,
      });
      if (!capabilityInstall.success) {
        console.error("[installPack] Site capability install failed:", capabilityInstall.error);
        toast.error(`Backend setup completed, but site capabilities failed: ${capabilityInstall.error || "Unknown error"}`);
        return;
      }
      
      // Store the result for display
      setInstallResult({ packId, data: installData });
      
      // Install the recipe pack record
      const { error } = await supabase
        .from("installed_recipe_packs")
        .upsert({
          business_id: businessId,
          pack_id: packId,
          enabled: true,
          installed_at: new Date().toISOString(),
        });

      if (error) {
        console.error("[installPack] Error saving pack record:", error);
        // Non-fatal - the system is installed even if this fails
      }

      // Enable all recipes in the pack by default
      if (pack.recipes?.length > 0) {
        const recipeInserts = pack.recipes.map(recipe => ({
          business_id: businessId,
          recipe_id: recipe.id,
          enabled: true,
          updated_at: new Date().toISOString(),
        }));
        
        await supabase
          .from("business_recipe_toggles")
          .upsert(recipeInserts);
        
        // Update local state
        const newToggles: Record<string, boolean> = {};
        pack.recipes.forEach(r => { newToggles[r.id] = true; });
        setRecipeToggles(prev => ({ ...prev, ...newToggles }));
      }

      setInstalledPacks((prev) => [...prev, packId]);
      
      // Show success with details
      const warnings: string[] = Array.isArray(resultData?.warnings) ? resultData.warnings : [];
      toast.success(
        `${pack.name} installed! ${resultData?.packs?.length || 0} backend packs, ${resultData?.intentsRegistered || 0} intents registered.`
      );
      if (warnings.length > 0) {
        toast.warning(`Install completed with warnings: ${warnings.join(', ')}`);
      }
    } catch (err) {
      console.error("[installPack] Error:", err);
      toast.error(`Failed to install pack: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
      setInstallingPackId(null);
    }
  }

  async function uninstallPack(packId: string) {
    try {
      const { error } = await supabase
        .from("installed_recipe_packs")
        .update({ enabled: false })
        .eq("business_id", businessId)
        .eq("pack_id", packId);

      if (error) throw error;

      setInstalledPacks((prev) => prev.filter((p) => p !== packId));
      toast.success("Recipe pack disabled");
    } catch (err) {
      console.error("Error uninstalling pack:", err);
      toast.error("Failed to disable pack");
    }
  }

  function updateSettings(key: keyof AutomationSettings, value: any) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function toggleDay(day: number) {
    const days = settings.business_days.includes(day)
      ? settings.business_days.filter((d) => d !== day)
      : [...settings.business_days, day].sort();
    updateSettings("business_days", days);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const relevantPacks = recipePacks.filter(
    (p) => !businessIndustry || p.industry === businessIndustry || p.industry === "general"
  );

  return (
    <div className="space-y-6">
      {/* Master Toggle */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className={`w-5 h-5 ${settings.automations_enabled ? "text-green-500" : "text-muted-foreground"}`} />
              <div>
                <CardTitle className="text-lg">Automations</CardTitle>
                <CardDescription>Enable or disable all workflow automations</CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.automations_enabled}
              onCheckedChange={(checked) => updateSettings("automations_enabled", checked)}
            />
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="recipes" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="recipes">
            <Package className="w-4 h-4 mr-2" />
            Recipes
          </TabsTrigger>
          <TabsTrigger value="timing">
            <Clock className="w-4 h-4 mr-2" />
            Timing
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Recipe Packs Tab */}
        <TabsContent value="recipes" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Site capability packs</CardTitle>
              <CardDescription>
                Install canonical capabilities for the selected project site. Recipe availability and industry do not control this list.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {!siteId && (
                <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-sm text-amber-200">
                    The selected project has no linked site. Choose a site-linked project to enable installation.
                  </p>
                  {siteProjects.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {siteProjects.map((siteProject) => (
                        <Button
                          key={siteProject.id}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onSelectProject(siteProject.id)}
                        >
                          {siteProject.name}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      No site-linked projects are available for this business.
                    </p>
                  )}
                </div>
              )}
              {SITE_CAPABILITY_PACKS.map((pack) => {
                const isInstalled = installedSiteCapabilities.includes(pack.id);
                const isInstalling = installingCapabilityId === pack.id;
                return (
                  <div key={pack.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">{pack.name}</div>
                      <div className="text-xs text-muted-foreground">{pack.description}</div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={isInstalled ? "outline" : "default"}
                      onClick={() => installSiteCapability(pack.id)}
                      disabled={isInstalled || installingCapabilityId !== null || !projectId || !siteId}
                      title={!siteId ? "Select a project with a linked site" : undefined}
                    >
                      {isInstalling ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                      {isInstalling ? "Installing..." : isInstalled ? "Installed" : "Install"}
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Installation Result Banner */}
          {installResult && (
            <Card className="border-green-500/50 bg-green-500/5">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-green-700 dark:text-green-400">
                      Pack Installed Successfully
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 space-y-1">
                      <div>• Business ID: <code className="bg-muted px-1 rounded text-xs">{installResult.data?.data?.businessId || installResult.data?.businessId}</code></div>
                      <div>• Backend packs: {(installResult.data?.data?.packs || installResult.data?.packs || []).join(', ')}</div>
                      <div>• Intents registered: {installResult.data?.data?.intentsRegistered || installResult.data?.intentsRegistered || 0}</div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setInstallResult(null)}
                    className="text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          {relevantPacks.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No recipe packs available for your industry
              </CardContent>
            </Card>
          ) : (
            relevantPacks.map((pack) => (
              <Card key={pack.pack_id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{pack.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{pack.name}</CardTitle>
                          <Badge variant="outline" className="text-xs">
                            {pack.tier}
                          </Badge>
                        </div>
                        <CardDescription className="text-sm">{pack.description}</CardDescription>
                      </div>
                    </div>
                    {installedPacks.includes(pack.pack_id) ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => syncSiteCapabilities(pack)}
                          disabled={installingPackId !== null || !projectId || !siteId}
                          title={!siteId ? "Select a project with a linked site to sync capabilities" : undefined}
                        >
                          {installingPackId === pack.pack_id ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4 mr-1" />
                          )}
                          Sync site capabilities
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => uninstallPack(pack.pack_id)}
                          className="text-muted-foreground"
                        >
                          <X className="w-4 h-4 mr-1" />
                          Disable
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        size="sm" 
                        onClick={() => installPack(pack.pack_id)}
                        disabled={installingPackId !== null || !projectId || !siteId}
                        title={!siteId ? "Select a project with a linked site to install this pack" : undefined}
                      >
                        {installingPackId === pack.pack_id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Installing...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-1" />
                            Install
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                {installedPacks.includes(pack.pack_id) && pack.recipes?.length > 0 && (
                  <CardContent className="pt-0">
                    <div className="border rounded-lg divide-y">
                      {pack.recipes.map((recipe) => (
                        <div key={recipe.id} className="flex items-center justify-between p-3">
                          <div>
                            <div className="font-medium text-sm">{recipe.name}</div>
                            <div className="text-xs text-muted-foreground">{recipe.description}</div>
                          </div>
                          <Switch
                            checked={recipeToggles[recipe.id] !== false}
                            onCheckedChange={(checked) => toggleRecipe(recipe.id, checked)}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </TabsContent>

        {/* Timing Tab */}
        <TabsContent value="timing" className="space-y-4 mt-4">
          {/* Business Hours */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <div>
                    <CardTitle className="text-base">Business Hours</CardTitle>
                    <CardDescription>Only send messages during business hours</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={settings.business_hours_enabled}
                  onCheckedChange={(checked) => updateSettings("business_hours_enabled", checked)}
                />
              </div>
            </CardHeader>
            {settings.business_hours_enabled && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={settings.business_hours_start}
                      onChange={(e) => updateSettings("business_hours_start", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={settings.business_hours_end}
                      onChange={(e) => updateSettings("business_hours_end", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Business Days</Label>
                  <div className="flex gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <Button
                        key={day.value}
                        type="button"
                        variant={settings.business_days.includes(day.value) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleDay(day.value)}
                        className="w-10 h-10"
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Quiet Hours */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MoonStar className="w-5 h-5 text-purple-500" />
                  <div>
                    <CardTitle className="text-base">Quiet Hours</CardTitle>
                    <CardDescription>No SMS or calls during these hours</CardDescription>
                  </div>
                </div>
                <Switch
                  checked={settings.quiet_hours_enabled}
                  onCheckedChange={(checked) => updateSettings("quiet_hours_enabled", checked)}
                />
              </div>
            </CardHeader>
            {settings.quiet_hours_enabled && (
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start (No messages after)</Label>
                    <Input
                      type="time"
                      value={settings.quiet_hours_start}
                      onChange={(e) => updateSettings("quiet_hours_start", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End (Resume at)</Label>
                    <Input
                      type="time"
                      value={settings.quiet_hours_end}
                      onChange={(e) => updateSettings("quiet_hours_end", e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Rate Limiting */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-orange-500" />
                <div>
                  <CardTitle className="text-base">Rate Limiting</CardTitle>
                  <CardDescription>Prevent spam and duplicate messages</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max messages per contact/day</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={settings.max_messages_per_contact_per_day}
                    onChange={(e) => updateSettings("max_messages_per_contact_per_day", parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dedup window (minutes)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={1440}
                    value={settings.dedupe_window_minutes}
                    onChange={(e) => updateSettings("dedupe_window_minutes", parseInt(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4 mt-4">
          {/* Sender Identity */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-green-500" />
                <div>
                  <CardTitle className="text-base">Sender Identity</CardTitle>
                  <CardDescription>Default sender information for outgoing messages</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Sender Name
                </Label>
                <Input
                  placeholder="Your Business Name"
                  value={settings.default_sender_name}
                  onChange={(e) => updateSettings("default_sender_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Sender Email
                </Label>
                <Input
                  type="email"
                  placeholder="noreply@yourbusiness.com"
                  value={settings.default_sender_email}
                  onChange={(e) => updateSettings("default_sender_email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Sender Phone
                </Label>
                <Input
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={settings.default_sender_phone}
                  onChange={(e) => updateSettings("default_sender_phone", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Compliance */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-red-500" />
                <div>
                  <CardTitle className="text-base">Compliance</CardTitle>
                  <CardDescription>Consent and messaging compliance settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <Label>Require consent for SMS</Label>
                </div>
                <Switch
                  checked={settings.require_consent_for_sms}
                  onCheckedChange={(checked) => updateSettings("require_consent_for_sms", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <Label>Require consent for email</Label>
                </div>
                <Switch
                  checked={settings.require_consent_for_email}
                  onCheckedChange={(checked) => updateSettings("require_consent_for_email", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4 text-muted-foreground" />
                  <Label>Honor STOP keywords (SMS)</Label>
                </div>
                <Switch
                  checked={settings.honor_stop_keywords}
                  onCheckedChange={(checked) => updateSettings("honor_stop_keywords", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
