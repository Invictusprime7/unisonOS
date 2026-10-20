import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { listProjectsCompat } from "@/services/projectSchemaCompat";
import { mergeWorkspaceProjects } from "@/services/cloudProjectDrafts";
import { AlertCircle } from "lucide-react";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { UnisonLoadingMark } from "@/components/UnisonLoadingMark";
import {
  clearSiteDiscoveryHandoff,
  readSiteDiscoveryHandoff,
  writeSiteDiscoveryHandoff,
} from "@/components/ai/siteDiscoveryPersistence";
import { 
  NavigationBar,
  HeroSection, 
  RecentProjectsSection,
  DifferenceSection,
  IntegrationsSection,
  FeaturesSection,
  PricingSection,
  CTASection,
  FooterSection,
  type RecentProject
} from "@/components/home/sections";

function isMissingUserSettingsError(error: unknown): boolean {
  const candidate = error as {
    code?: string;
    status?: number;
    message?: string;
    details?: string;
  } | null;
  const combined = [candidate?.message, candidate?.details].filter(Boolean).join(' ').toLowerCase();
  return (
    candidate?.code === '42P01' ||
    candidate?.code === 'PGRST205' ||
    candidate?.status === 404 ||
    combined.includes('user_settings')
  );
}

async function readUserSettings(userId: string): Promise<unknown | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', userId)
    .limit(1);

  if (error) {
    if (isMissingUserSettingsError(error)) {
      return null;
    }
    throw error;
  }

  return data?.[0]?.settings ?? null;
}

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launchBrief, setLaunchBrief] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [connectedIntegrations, setConnectedIntegrations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    if (!isSupabaseConfigured) {
      console.warn('⚠️ Backend is not properly configured. Some features may not work.');
    }

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setLauncherOpen(false);
    setLaunchBrief(null);
    if (!user) return;
    try {
      const savedBrief = readSiteDiscoveryHandoff(user.id);
      if (savedBrief) {
        setLaunchBrief(savedBrief);
        setLauncherOpen(true);
      }
    } catch (error) {
      console.error("[Home] Could not restore confirmed site brief.", error);
      toast({
        title: "Couldn't restore your site plan",
        description: "Your saved homepage conversation is still available. Please confirm the brief again to reopen the Wizard.",
        variant: "destructive",
      });
    }
  }, [user?.id]);

  // Use the same merged project + draft projection as Cloud. A project's row
  // and its linked draft can be updated independently, so drafts alone do not
  // reliably represent the authenticated profile's newest work.
  useEffect(() => {
    const userId = user?.id;
    if (!userId || !isSupabaseConfigured) return;

    // Remove the owner's empty shells (no saved version, no source, older than
    // an hour) once per visit before listing.
    const cleanup = supabase.rpc('cleanup_empty_projects').then(
      ({ error }) => { if (error) console.warn('[Home] Empty project cleanup skipped:', error.message); },
      () => undefined,
    );

    const loadRecentProjects = async () => {
      setLoadingProjects(true);
      try {
        await cleanup;
        const [projectResult, draftResult] = await Promise.all([
          listProjectsCompat({ ownerId: userId, limit: 100 }),
          supabase
            .from('builder_drafts')
            // Summary fields only: generated VFS files are loaded by WebBuilder
            // after the user opens a card.
            .select('id, name, project_id, business_id, last_revision_id, updated_at, created_at, previewCode:metadata->>previewCode, metaName:metadata->>name, metaDescription:metadata->>description')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(100),
        ]);

        if (projectResult.error && draftResult.error) {
          console.error('Error loading recent projects:', projectResult.error || draftResult.error);
          return;
        }

        // PostgREST normally returns object rows only. Filter defensively so a
        // transient null row during a migration/session refresh cannot take down
        // the authenticated home screen.
        const rows = ((draftResult.data || []) as any[]).filter((row): row is Record<string, any> =>
          Boolean(row && typeof row === 'object'),
        );
        const allRevisionIds = rows.map((row) => row.last_revision_id).filter(Boolean);
        const revisionTimes = new Map<string, string>();
        if (allRevisionIds.length) {
          const { data: revisions } = await supabase
            .from('site_revisions')
            .select('id, created_at')
            .in('id', allRevisionIds);
          for (const revision of (revisions || []) as any[]) {
            if (revision?.id && revision?.created_at) {
              revisionTimes.set(revision.id, revision.created_at);
            }
          }
        }
        const workspaceProjects = mergeWorkspaceProjects(
          projectResult.error ? [] : projectResult.data || [],
          rows as any,
          revisionTimes,
        ).slice(0, 9);
        const draftsById = new Map(rows.map((row) => [row.id, row]));

        const projects: RecentProject[] = workspaceProjects.map((project) => {
          const draft = project.draft_id ? draftsById.get(project.draft_id) : null;
          const previewCode = typeof draft?.previewCode === 'string' ? draft.previewCode : '';
          const savedAt = (project.revision_id && revisionTimes.get(project.revision_id)) || project.updated_at || project.created_at;
          return {
            id: project.id,
            draft_id: project.draft_id ?? null,
            project_id: project.draft_only ? null : project.id,
            business_id: project.business_id ?? null,
            revision_id: project.revision_id ?? null,
            name: project.name || draft?.name || draft?.metaName || 'Untitled Project',
            description: project.description ?? draft?.metaDescription ?? null,
            is_public: false,
            updated_at: savedAt,
            created_at: project.created_at,
            canvas_data: { previewCode, html: previewCode },
          };
        });
        setRecentProjects(projects);
      } catch (err) {
        console.error('Failed to load recent projects:', err);
      } finally {
        setLoadingProjects(false);
      }
    };

    void loadRecentProjects();
    const onFocus = () => { void loadRecentProjects(); };
    window.addEventListener('focus', onFocus);
    const channel = supabase
      .channel(`home-recent-drafts:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'builder_drafts',
        filter: `user_id=eq.${userId}`,
      }, () => { void loadRecentProjects(); })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `owner_id=eq.${userId}`,
      }, () => { void loadRecentProjects(); })
      .subscribe();
    return () => {
      window.removeEventListener('focus', onFocus);
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Load connected integrations when user is authenticated
  useEffect(() => {
    const loadConnectedIntegrations = async () => {
      if (!user || !isSupabaseConfigured) return;
      
      try {
        const rawSettings = await readUserSettings(user.id);

        if (rawSettings) {
          const settings = typeof rawSettings === 'string'
            ? JSON.parse(rawSettings)
            : rawSettings;
            
          if (settings.integrations) {
            const connected: Record<string, boolean> = {};
            Object.keys(settings.integrations).forEach(key => {
              connected[key] = settings.integrations[key]?.connected || false;
            });
            setConnectedIntegrations(connected);
          }
        }
      } catch (error) {
        console.error('Error loading connected integrations:', error);
      }
    };

    loadConnectedIntegrations();
  }, [user]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out:", error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } else {
      setUser(null);
    }
  };

  // Entry point for the wizard — skip the CreateProjectDialog step.
  // Project row creation is handled by the db trigger after the draft is saved.
  const handleNewProject = () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    try {
      clearSiteDiscoveryHandoff(user.id);
    } catch (error) {
      console.error("[Home] Could not clear the previous Wizard handoff.", error);
    }
    setLaunchBrief(null);
    setLauncherOpen(true);
    document.getElementById('home-ai-chat')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleStartLauncher = () => {
    handleNewProject();
  };

  const handleConfirmedSite = (siteBrief: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    try {
      writeSiteDiscoveryHandoff(user.id, siteBrief);
    } catch (error) {
      console.error("[Home] Could not persist confirmed site brief.", error);
      toast({
        title: "Wizard opened, but couldn't save your progress",
        description: "Keep this page open to continue. Your AI conversation is saved on this device.",
        variant: "destructive",
      });
    }
    setLaunchBrief(siteBrief);
    setLauncherOpen(true);
  };

  const handleConnectIntegration = async (integrationId: string, apiKey: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const existingSettingsValue = await readUserSettings(user.id);

    const currentSettings = existingSettingsValue
      ? (typeof existingSettingsValue === 'string'
          ? JSON.parse(existingSettingsValue)
          : existingSettingsValue)
      : {};

    const newSettings = {
      ...currentSettings,
      integrations: {
        ...(currentSettings.integrations || {}),
        [integrationId]: {
          connected: true,
          connectedAt: new Date().toISOString(),
        },
      },
    };

    const { error: upsertError } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        settings: newSettings,
      });

    if (upsertError && !isMissingUserSettingsError(upsertError)) {
      throw upsertError;
    }

    setConnectedIntegrations(prev => ({
      ...prev,
      [integrationId]: true
    }));
  };

  const handleDisconnectIntegration = async (integrationId: string) => {
    if (!user) return;

    const existingSettingsValue = await readUserSettings(user.id);

    const currentSettings = existingSettingsValue
      ? (typeof existingSettingsValue === 'string'
          ? JSON.parse(existingSettingsValue)
          : existingSettingsValue)
      : {};

    const newIntegrations = { ...(currentSettings.integrations || {}) };
    delete newIntegrations[integrationId];

    const { error: upsertError } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        settings: {
          ...currentSettings,
          integrations: newIntegrations,
        },
      });

    if (upsertError && !isMissingUserSettingsError(upsertError)) {
      throw upsertError;
    }

    setConnectedIntegrations(prev => {
      const updated = { ...prev };
      delete updated[integrationId];
      return updated;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a12] flex items-center justify-center">
        <div className="text-center">
          <UnisonLoadingMark size={48} className="mx-auto mb-4 drop-shadow-[0_0_15px_rgba(0,255,255,0.6)]" />
          <p className="text-cyan-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a12] relative">
      {/* Pixelated grid background - entire page */}
      <div 
        className="fixed inset-0 opacity-20 pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%2300ffff' fill-opacity='0.15'%3E%3Crect x='0' y='0' width='4' height='4'/%3E%3Crect x='20' y='0' width='4' height='4'/%3E%3Crect x='0' y='20' width='4' height='4'/%3E%3Crect x='20' y='20' width='4' height='4'/%3E%3Crect x='10' y='10' width='4' height='4'/%3E%3Crect x='30' y='10' width='4' height='4'/%3E%3Crect x='10' y='30' width='4' height='4'/%3E%3Crect x='30' y='30' width='4' height='4'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '40px 40px'
        }}
      />
      {/* Scanline effect - entire page */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.1) 2px, rgba(0,255,255,0.1) 4px)',
        }}
      />
      {/* Configuration Warning */}
      {!isSupabaseConfigured && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3">
          <div className="container mx-auto flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">
              <strong>Configuration Warning:</strong> Backend environment variables are not properly set.
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <NavigationBar
        user={user}
        docsOpen={docsOpen}
        onDocsOpenChange={setDocsOpen}
        onSignOut={handleSignOut}
        onStartLauncher={handleNewProject}
      />

      {/* Hero Section */}
      <HeroSection 
        user={user}
        onAuthRequired={() => navigate("/auth")}
        onSiteConfirmed={handleConfirmedSite}
        launcherOpen={launcherOpen}
        launchBrief={launchBrief}
        onLauncherOpenChange={(open) => {
          setLauncherOpen(open);
          if (!open) {
            setLaunchBrief(null);
            if (user) {
              try {
                clearSiteDiscoveryHandoff(user.id);
              } catch (error) {
                console.error("[Home] Could not clear the completed Wizard handoff.", error);
              }
            }
          }
        }}
      />

      {/* Recent Projects Section - Only visible for authenticated users */}
      {user && (
        <RecentProjectsSection
          projects={recentProjects}
          loading={loadingProjects}
          onStartLauncher={handleNewProject}
        />
      )}

      {/* The Difference Section */}
      <DifferenceSection />

      {/* Integrations Section */}
      <IntegrationsSection
        connectedIntegrations={connectedIntegrations}
        onConnectIntegration={handleConnectIntegration}
        onDisconnectIntegration={handleDisconnectIntegration}
      />

      {/* Features Section */}
      <FeaturesSection />

      {/* Pricing Section */}
      <PricingSection onStartLauncher={handleStartLauncher} />

      {/* CTA Section */}
      <CTASection onStartLauncher={handleStartLauncher} />

      {/* Footer */}
      <FooterSection />

    </div>
  );
};

export default Index;
