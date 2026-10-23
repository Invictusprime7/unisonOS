/**
 * CLOUD PROJECTS - Unified Business & Project Management
 * 
 * Redesigned for a cleaner, less cluttered user experience with:
 * - Clean sidebar navigation
 * - Simplified project cards
 * - Easy project management
 */

import React, { useState, useEffect } from 'react';
import { 
  FolderKanban, Plus, Globe, Settings, Trash2, ExternalLink,
  Sparkles, Rocket, Layout, Palette, Clock, ChevronRight,
  MoreVertical, Copy, Star, FileText, Home, Download,
  Building2, Users, Loader2, Paintbrush, ArrowLeft,
  BarChart3, Target, Workflow, Zap,
  Search, Grid3X3, List, Edit3, Eye, ChevronDown, Database
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase as supabaseClient } from '@/integrations/supabase/client';
const supabase = supabaseClient as any;
import { useToast } from '@/hooks/use-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { downloadMultiPageSite } from '@/utils/multiPageExporter';
import {
  createProjectCompat,
  listProjectIdsByBusinessCompat,
  listProjectsCompat,
} from '@/services/projectSchemaCompat';
import { mergeWorkspaceProjects } from '@/services/cloudProjectDrafts';
import { findBuilderDraftIdForProject, findLatestBuilderDraftProjectionForProject } from '@/services/builderDraftBridge';
import { migrateCloudProjects, type CloudMigrationResult } from '@/services/cloudProjectCanonicalMigration';
import { recoverLegacyCloudProject } from '@/services/legacyCloudProjectRecovery';
import { repairDraftBusinessLink } from '@/services/draftBusinessLinkRepair';

import CRMDashboard, { type CRMView } from '@/pages/CRMDashboard';
import { CloudTeams } from './CloudTeams';
import { CloudDatabase } from './CloudDatabase';
import { BusinessAutomationSettings } from '@/components/crm/BusinessAutomationSettings';
import { ProjectSettingsPanel } from '@/components/project/ProjectSettingsPanel';

import type { Json } from '@/integrations/supabase/types';

const BUSINESS_CACHE_KEY_PREFIX = 'cloud-projects:businesses';
const PROJECT_CACHE_KEY_PREFIX = 'cloud-projects:projects';
const SELECTED_BUSINESS_KEY_PREFIX = 'cloud-projects:selected-business';

function readSessionCache<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeSessionCache<T>(key: string, value: T) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore cache write failures.
  }
}

interface CloudProjectsProps {
  userId: string;
  businessId?: string;
  onProjectSelect?: (project: Project) => void;
}

interface Project {
  id: string;
  name: string;
  slug?: string;
  status?: string | null;
  publish_status?: string | null;
  template_type?: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  published_at?: string;
  business_id?: string;
  site_id?: string | null;
  owner_id?: string;
  user_id?: string;
  preview_ready?: boolean;
  custom_domain?: string;
  settings?: Record<string, any>;
  draft_id?: string | null;
  revision_id?: string | null;
  draft_only?: boolean;
}

interface Business {
  id: string;
  name: string;
  slug?: string;
  industry?: string;
  website?: string;
  created_at?: string;
  owner_id?: string;
  notification_email?: string;
  notification_phone?: string;
  settings?: Json;
  last_activity_at?: string | null;
}

function isMissingBusinessMembersTable(error: unknown): boolean {
  const candidate = error as {
    code?: string;
    status?: number;
    message?: string;
    details?: string;
  } | null;
  const text = [candidate?.message, candidate?.details]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return (
    candidate?.status === 404 ||
    candidate?.code === '42P01' ||
    candidate?.code === 'PGRST204' ||
    candidate?.code === 'PGRST205' ||
    text.includes('could not find the table') ||
    text.includes('business_members') ||
    text.includes('schema cache')
  );
}

const transformBusiness = (data: Record<string, unknown>): Business => ({
  id: data.id as string,
  name: data.name as string,
  slug: data.slug as string | undefined,
  industry: data.industry as string | undefined,
  website: data.website as string | undefined,
  created_at: data.created_at as string | undefined,
  owner_id: data.owner_id as string | undefined,
  notification_email: data.notification_email as string | undefined,
  notification_phone: data.notification_phone as string | undefined,
  settings: data.settings as Json | undefined,
});

function formatSavedAt(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type ViewMode = 'grid' | 'list';
type BusinessSection = 'projects' | 'crm' | 'automations' | 'team' | 'settings' | 'database';

interface CloudProjectsLocationState {
  tab?: 'overview' | 'projects' | 'assets' | 'email' | 'integrations' | 'security' | 'profile';
  workspaceSection?: BusinessSection;
  businessId?: string;
  projectId?: string;
  crmView?: CRMView;
}

function ProjectIdChip({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy project ID"
      aria-label={`Copy project ID ${id}`}
      onClick={(event) => {
        event.stopPropagation();
        void navigator.clipboard?.writeText(id).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="mt-1 inline-flex max-w-full items-center gap-1 text-left font-mono text-[11px] text-white/40 hover:text-white/80"
    >
      <span className="truncate">ID {id}</span>
      {copied ? <Check className="h-3 w-3 shrink-0" /> : <Copy className="h-3 w-3 shrink-0" />}
    </button>
  );
}

export function CloudProjects({ userId, businessId: propBusinessId, onProjectSelect }: CloudProjectsProps) {
  const [migrationProgress, setMigrationProgress] = useState<{ completed: number; total: number } | null>(null);
  const [migrationResults, setMigrationResults] = useState<CloudMigrationResult[] | null>(null);
  const restoreCloudProjects = async () => {
    setMigrationProgress({ completed: 0, total: 0 });
    try {
      setMigrationResults(await migrateCloudProjects((completed, total) => setMigrationProgress({ completed, total })));
      window.dispatchEvent(new CustomEvent('unison:project-draft-saved'));
    } catch (error) {
      setMigrationResults([{ draftId: '', projectId: '', converted: false, notes: [error instanceof Error ? error.message : String(error)] }]);
    } finally { setMigrationProgress(null); }
  };
  // Core state
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [recoveredProjects, setRecoveredProjects] = useState<Project[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [supportsBusinessMembers, setSupportsBusinessMembers] = useState(true);
  const [businessSelectionMode, setBusinessSelectionMode] = useState(false);
  const [selectedBusinessIds, setSelectedBusinessIds] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<BusinessSection>('projects');
  const [crmView, setCrmView] = useState<CRMView>('overview');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [recoveredSearchQuery, setRecoveredSearchQuery] = useState('');

  // Dialog states
  const [createBusinessOpen, setCreateBusinessOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [recoveredProjectsOpen, setRecoveredProjectsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [projectSelectionMode, setProjectSelectionMode] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [bulkProjectDeleteOpen, setBulkProjectDeleteOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'business' | 'project'; item: Business | Project } | null>(null);
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedProjectScopeId, setSelectedProjectScopeId] = useState<string | null>(null);
  const [businessSettingsSaving, setBusinessSettingsSaving] = useState(false);
  const [businessSettingsForm, setBusinessSettingsForm] = useState({
    name: '',
    website: '',
    industry: '',
    notificationEmail: '',
    notificationPhone: '',
  });

  // Form states
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [creatingBusiness, setCreatingBusiness] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const businessCacheKey = `${BUSINESS_CACHE_KEY_PREFIX}:${userId}`;
  const selectedBusinessKey = `${SELECTED_BUSINESS_KEY_PREFIX}:${userId}`;
  const rememberSelectedBusiness = (businessId: string) => {
    window.localStorage.setItem(selectedBusinessKey, businessId);
    window.localStorage.setItem(`${selectedBusinessKey}:at`, new Date().toISOString());
  };

  useEffect(() => {
    if (!userId) return;

    const cachedBusinesses = readSessionCache<Business[]>(businessCacheKey);
    if (!cachedBusinesses || cachedBusinesses.length === 0) {
      return;
    }

    setBusinesses((current) => (current.length > 0 ? current : cachedBusinesses));
    setSelectedBusiness((current) => {
      if (current) return current;

      const state = (location.state as CloudProjectsLocationState | null) ?? null;
      const preferredBusinessId =
        state?.businessId ||
        propBusinessId ||
        window.localStorage.getItem(selectedBusinessKey);
      if (preferredBusinessId) {
        return cachedBusinesses.find((business) => business.id === preferredBusinessId) || cachedBusinesses[0] || null;
      }

      return cachedBusinesses[0] || null;
    });
    setLoading(false);
  }, [businessCacheKey, location.state, propBusinessId, selectedBusinessKey, userId]);

  // Load businesses on mount
  useEffect(() => {
    if (userId) loadBusinesses();
  }, [userId]);

  // Re-rank workspaces when the user returns from the builder or a save lands,
  // so the most recently saved site surfaces without a manual reload.
  useEffect(() => {
    if (!userId) return;
    let timer: number | null = null;
    const refresh = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void loadBusinesses(), 300);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('unison:project-draft-saved', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('unison:project-draft-saved', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const loadRecoveredProjects = async () => {
      const [projectResult, draftResult] = await Promise.all([
        listProjectsCompat({ ownerId: userId }),
        supabase
          .from('builder_drafts')
          .select('id, project_id, business_id, name, metadata, vfs_files, code, editor_code, last_revision_id, created_at, updated_at')
          .eq('user_id', userId)
          .is('business_id', null)
          .order('updated_at', { ascending: false }),
      ]);

      if (cancelled) return;
      if (projectResult.error || draftResult.error) {
        console.error('[CloudProjects] failed to load recovered projects:', projectResult.error || draftResult.error);
        return;
      }

      const previewReadyDraftIds = new Set(
        (draftResult.data || [])
          .filter((draft: any) => {
            const metadata = (draft.metadata || {}) as Record<string, any>;
            const files = draft.vfs_files || metadata.vfsFiles || metadata.siteBundleSnapshot?.vfsFiles;
            return (
              (files && typeof files === 'object' && Object.keys(files).length > 0) ||
              Boolean(String(draft.editor_code || draft.code || '').trim())
            );
          })
          .map((draft: any) => draft.id),
      );

      setRecoveredProjects(
        mergeWorkspaceProjects(projectResult.data || [], (draftResult.data || []) as any)
          .filter((project) => !project.business_id && Boolean(project.draft_id))
          .map((project) => ({
            ...project,
            preview_ready: previewReadyDraftIds.has(project.draft_id || ''),
          })),
      );
    };

    void loadRecoveredProjects();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const state = (location.state as CloudProjectsLocationState | null) ?? null;
    if (!state) return;

    if (state.workspaceSection) {
      setActiveSection(state.workspaceSection);
    }

    if (state.crmView) {
      setCrmView(state.crmView);
    }

    if (state.businessId) {
      const match = businesses.find((business) => business.id === state.businessId);
      if (match && selectedBusiness?.id !== match.id) {
        setSelectedBusiness(match);
      }
    }
  }, [location.state, businesses, selectedBusiness?.id]);

  // Load projects when business selected
  useEffect(() => {
    if (selectedBusiness) loadProjects(selectedBusiness.id);
  }, [selectedBusiness]);

  // Keep an open workspace current after autosaves in this tab and after
  // Postgres changes from other tabs/devices. Focus refresh is the fallback
  // when Realtime replication is unavailable or reconnecting.
  useEffect(() => {
    const selectedBusinessId = selectedBusiness?.id;
    if (!selectedBusinessId || !userId) return;

    let refreshTimer: number | null = null;
    const refresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void loadProjects(selectedBusinessId), 120);
    };
    const onDraftSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ businessId?: string | null }>).detail;
      if (!detail?.businessId || detail.businessId === selectedBusinessId) refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('unison:project-draft-saved', onDraftSaved);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);

    const channel = supabase
      .channel(`cloud-projects:${userId}:${selectedBusinessId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'builder_drafts',
        filter: `business_id=eq.${selectedBusinessId}`,
      }, refresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `business_id=eq.${selectedBusinessId}`,
      }, refresh)
      .subscribe((status: string, error: unknown) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[CloudProjects] live workspace updates degraded:', status, error);
        }
      });

    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      window.removeEventListener('unison:project-draft-saved', onDraftSaved);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      void supabase.removeChannel(channel);
    };
  }, [selectedBusiness?.id, userId]);

  useEffect(() => {
    const state = (location.state as CloudProjectsLocationState | null) ?? null;
    if (!state?.projectId || projects.length === 0) return;
    const projectExists = projects.some((project) => project.id === state.projectId);
    if (projectExists) {
      setSelectedProjectScopeId(state.projectId);
    }
  }, [location.state, projects]);

  useEffect(() => {
    if (!selectedBusiness) {
      setBusinessSettingsForm({
        name: '',
        website: '',
        industry: '',
        notificationEmail: '',
        notificationPhone: '',
      });
      return;
    }

    setBusinessSettingsForm({
      name: selectedBusiness.name || '',
      website: selectedBusiness.website || '',
      industry: selectedBusiness.industry || '',
      notificationEmail: selectedBusiness.notification_email || '',
      notificationPhone: selectedBusiness.notification_phone || '',
    });
  }, [selectedBusiness]);

  // ==================== DATA OPERATIONS ====================

  const loadBusinesses = async () => {
    try {
      const { data: ownedBusinesses, error: ownedError } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      const { data: memberBusinesses, error: memberError } = supportsBusinessMembers
        ? await supabase
            .from('business_members')
            .select('business:businesses(*)')
            .eq('user_id', userId)
        : { data: [], error: null };

      let safeMemberBusinesses = memberBusinesses;
      let safeMemberError = memberError;
      if (memberError && isMissingBusinessMembersTable(memberError)) {
        setSupportsBusinessMembers(false);
        safeMemberBusinesses = [];
        safeMemberError = null;
      }

      if (ownedError && safeMemberError) {
        setBusinesses([]);
      } else {
        const owned = (ownedBusinesses || []).map(transformBusiness);
        const memberOf = (safeMemberBusinesses || [])
          .map((m: any) => m.business)
          .filter(Boolean)
          .map(transformBusiness);
        
        const merged = [...owned];
        memberOf.forEach(b => {
          if (!merged.find(ob => ob.id === b.id)) {
            merged.push(b);
          }
        });

        // Order workspaces by their latest saved draft so the site the user
        // just edited is always on top (each wizard launch creates its own
        // business, so creation order hides recent saves).
        const lastActivity = new Map<string, string>();
        if (merged.length > 0) {
          const { data: activityRows } = await supabase
            .from('builder_drafts')
            .select('business_id, updated_at')
            .in('business_id', merged.map((b) => b.id))
            .order('updated_at', { ascending: false })
            .limit(500);
          for (const row of activityRows || []) {
            if (row.business_id && row.updated_at && !lastActivity.has(row.business_id)) {
              lastActivity.set(row.business_id, row.updated_at);
            }
          }
        }
        const allBusinesses = merged
          .map((b) => ({ ...b, last_activity_at: lastActivity.get(b.id) || null }))
          .sort((a, b) =>
            String(b.last_activity_at || b.created_at || '').localeCompare(
              String(a.last_activity_at || a.created_at || ''),
            ),
          );
        
        setBusinesses(allBusinesses);
        writeSessionCache(businessCacheKey, allBusinesses);
        
        // Explicit navigation wins. Otherwise keep the user's last pick unless
        // another workspace was saved after that pick — then open the newest.
        const routeState = (location.state as CloudProjectsLocationState | null) ?? null;
        const explicitBusinessId = routeState?.businessId || propBusinessId;
        const newest = allBusinesses[0] || null;
        let next: Business | null = null;
        if (explicitBusinessId) {
          next = allBusinesses.find(b => b.id === explicitBusinessId) || null;
        } else {
          const storedId = window.localStorage.getItem(selectedBusinessKey);
          const storedAt = window.localStorage.getItem(`${selectedBusinessKey}:at`) || '';
          const stored = storedId ? allBusinesses.find(b => b.id === storedId) : undefined;
          const newerSaveElsewhere =
            !!newest?.last_activity_at &&
            newest.id !== stored?.id &&
            newest.last_activity_at > storedAt;
          next = stored && !newerSaveElsewhere ? stored : newest;
        }
        if (next) {
          setSelectedBusiness((current) => (current?.id === next!.id ? current : next));
        }
      }
    } catch (error) {
      console.error('Error loading businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async (businessId: string) => {
    try {
      const [projectResult, draftResult] = await Promise.all([
        listProjectsCompat({ ownerId: userId, businessId }),
        supabase
          .from('builder_drafts')
          .select('id, project_id, business_id, name, metadata, last_revision_id, created_at, updated_at')
          .eq('user_id', userId)
          .eq('business_id', businessId)
          .order('updated_at', { ascending: false }),
      ]);
      const { data, error } = projectResult;

      if (error) {
        throw error;
      } else if (draftResult.error) {
        throw draftResult.error;
      } else {
        const nextProjects = mergeWorkspaceProjects(
          data || [],
          (draftResult.data || []) as any,
        );
        setProjects(nextProjects);
        writeSessionCache(`${PROJECT_CACHE_KEY_PREFIX}:${userId}:${businessId}`, nextProjects);
        setSelectedProjectScopeId((current) =>
          current && nextProjects.some((project) => project.id === current)
            ? current
            : nextProjects[0]?.id || null
        );
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      setProjects([]);
      setSelectedProjectScopeId(null);
    }
  };

  useEffect(() => {
    if (!selectedBusiness?.id) return;

    const cachedProjects = readSessionCache<Project[]>(`${PROJECT_CACHE_KEY_PREFIX}:${userId}:${selectedBusiness.id}`);
    if (!cachedProjects) {
      return;
    }

    setProjects((current) => (current.length > 0 ? current : cachedProjects));
    setSelectedProjectScopeId((current) => {
      if (current && cachedProjects.some((project) => project.id === current)) {
        return current;
      }

      const state = (location.state as CloudProjectsLocationState | null) ?? null;
      if (state?.projectId && cachedProjects.some((project) => project.id === state.projectId)) {
        return state.projectId;
      }

      return cachedProjects[0]?.id || null;
    });
  }, [location.state, selectedBusiness?.id, userId]);

  const createBusiness = async () => {
    if (!newBusinessName.trim()) return;
    setCreatingBusiness(true);
    try {
      const { data, error } = await supabase
        .from('businesses')
        .insert({ name: newBusinessName.trim(), owner_id: userId })
        .select()
        .single();

      if (error) throw error;

      const newBiz = transformBusiness(data);
      setBusinesses([newBiz, ...businesses]);
      setSelectedBusiness(newBiz);
      setCreateBusinessOpen(false);
      setNewBusinessName('');
      toast({ title: 'Business created', description: `${newBusinessName} is ready.` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create business.', variant: 'destructive' });
    } finally {
      setCreatingBusiness(false);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim() || !selectedBusiness) return;
    setCreatingProject(true);
    try {
      const slug = newProjectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 50);
      const { data, error } = await createProjectCompat({
        name: newProjectName,
        description: newProjectDescription || null,
        slug,
        owner_id: userId,
        business_id: selectedBusiness.id,
        status: 'draft',
        publish_status: 'draft',
      });

      if (error) throw error;
      if (!data) throw new Error('Project creation returned no data.');

      setProjects([data, ...projects]);
      setSelectedProjectScopeId(data.id);
      setCreateProjectOpen(false);
      setNewProjectName('');
      setNewProjectDescription('');
      toast({ title: 'Project created', description: `${newProjectName} is ready to edit.` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create project.', variant: 'destructive' });
    } finally {
      setCreatingProject(false);
    }
  };

  const cleanupBusinessScopedArtifacts = async (businessIds: string[]) => {
    const targetBusinessIds = Array.from(new Set(businessIds.filter(Boolean)));
    if (targetBusinessIds.length === 0) return;

    const { data: drafts, error: draftsError } = await supabase
      .from('builder_drafts')
      .select('id, user_id, metadata')
      .in('business_id', targetBusinessIds);

    if (draftsError) throw draftsError;

    const { data: scopedProjects, error: projectsError } = await listProjectIdsByBusinessCompat(targetBusinessIds);

    if (projectsError) throw projectsError;

    const draftIds = (drafts || []).map((draft) => draft.id);
    const scopedProjectIds = (scopedProjects || []).map((project) => project.id);

    const legacyDraftKeys = Array.from(new Set(
      (drafts || [])
        .map((draft) => {
          const metadata = (draft.metadata || {}) as Record<string, unknown>;
          const draftName = String(
            metadata.name ||
            metadata.projectName ||
            metadata.business_name ||
            ''
          ).trim();
          if (!draft.user_id || !draftName) return null;
          return `${draft.user_id}:::${draftName}`;
        })
        .filter((value): value is string => Boolean(value)),
    ));

    let legacyProjectIds: string[] = [];
    if (legacyDraftKeys.length > 0) {
      const { data: legacyProjects, error: legacyProjectsError } = await listProjectsCompat({
        ownerId: userId,
      });

      if (legacyProjectsError) throw legacyProjectsError;

      legacyProjectIds = (legacyProjects || [])
        .filter((project) => {
          const projectKey = `${project.owner_id}:::${String(project.name || '').trim()}`;
          if (!legacyDraftKeys.includes(projectKey)) {
            return false;
          }
          if (project.business_id) {
            return false;
          }
          if (project.status && project.status !== 'draft') {
            return false;
          }
          if (project.publish_status && project.publish_status !== 'draft') {
            return false;
          }
          if (project.custom_domain || project.published_at || project.template_type) {
            return false;
          }
          return true;
        })
        .map((project) => project.id);
    }

    const projectIds = Array.from(new Set([...scopedProjectIds, ...legacyProjectIds]));

    if (draftIds.length > 0) {
      const { error } = await supabase
        .from('builder_drafts')
        .delete()
        .in('id', draftIds);

      if (error) throw error;
    }

    if (projectIds.length > 0) {
      const { error } = await supabase
        .from('projects')
        .delete()
        .in('id', projectIds);

      if (error) throw error;
    }
  };

  const confirmDelete = (type: 'business' | 'project', item: Business | Project) => {
    setItemToDelete({ type, item });
    setDeleteConfirmOpen(true);
  };

  const exitBusinessSelectionMode = () => {
    setBusinessSelectionMode(false);
    setSelectedBusinessIds([]);
  };

  const toggleBusinessSelection = (businessId: string) => {
    setSelectedBusinessIds((current) =>
      current.includes(businessId)
        ? current.filter((id) => id !== businessId)
        : [...current, businessId]
    );
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    
    const { type, item } = itemToDelete;
    try {
      if (type === 'business') {
        await cleanupBusinessScopedArtifacts([item.id]);
      }

      const deleteDraftOnly = type === 'project' && (item as Project).draft_only;
      const { error } = await supabase
        .from(deleteDraftOnly ? 'builder_drafts' : type === 'business' ? 'businesses' : 'projects')
        .delete()
        .eq('id', deleteDraftOnly ? (item as Project).draft_id || item.id : item.id);

      if (error) throw error;

      if (type === 'business') {
        const updated = businesses.filter(b => b.id !== item.id);
        setBusinesses(updated);
        setSelectedBusinessIds((current) => current.filter((id) => id !== item.id));
        if (selectedBusiness?.id === item.id) {
          setSelectedBusiness(updated[0] || null);
          if (updated.length === 0) {
            setProjects([]);
            setSelectedProjectScopeId(null);
          }
        }
      } else {
        const updatedProjects = projects.filter(p => p.id !== item.id);
        setProjects(updatedProjects);
        setSelectedProjectScopeId((current) =>
          current === item.id ? updatedProjects[0]?.id || null : current
        );
        if (selectedProject?.id === item.id) {
          setSelectedProject(null);
          setProjectSettingsOpen(false);
        }
      }

      toast({ title: `${type === 'business' ? 'Business' : 'Project'} deleted` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete.', variant: 'destructive' });
    } finally {
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const executeBulkDeleteBusinesses = async () => {
    if (selectedBusinessIds.length === 0) return;

    try {
      await cleanupBusinessScopedArtifacts(selectedBusinessIds);

      const { error } = await supabase
        .from('businesses')
        .delete()
        .in('id', selectedBusinessIds);

      if (error) throw error;

      const selectedIds = new Set(selectedBusinessIds);
      const updatedBusinesses = businesses.filter((business) => !selectedIds.has(business.id));
      setBusinesses(updatedBusinesses);

      if (selectedBusiness && selectedIds.has(selectedBusiness.id)) {
        setSelectedBusiness(updatedBusinesses[0] || null);
        if (updatedBusinesses.length === 0) {
          setProjects([]);
          setSelectedProjectScopeId(null);
        }
      }

      toast({
        title: `${selectedBusinessIds.length} business${selectedBusinessIds.length === 1 ? '' : 'es'} deleted`,
      });
      exitBusinessSelectionMode();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete businesses.',
        variant: 'destructive',
      });
    } finally {
      setBulkDeleteConfirmOpen(false);
    }
  };

  const exitProjectSelectionMode = () => {
    setProjectSelectionMode(false);
    setSelectedProjectIds([]);
  };

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds((current) =>
      current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId]
    );
  };

  const executeBulkDeleteProjects = async () => {
    if (selectedProjectIds.length === 0) return;
    const selectedIds = new Set(selectedProjectIds);
    const targets = projects.filter((p) => selectedIds.has(p.id));
    const draftOnlyIds = targets.filter((p) => p.draft_only).map((p) => p.draft_id || p.id);
    const projectIds = targets.filter((p) => !p.draft_only).map((p) => p.id);
    try {
      if (draftOnlyIds.length > 0) {
        const { error } = await supabase.from('builder_drafts').delete().in('id', draftOnlyIds);
        if (error) throw error;
      }
      if (projectIds.length > 0) {
        const { error } = await supabase.from('projects').delete().in('id', projectIds);
        if (error) throw error;
      }
      const updatedProjects = projects.filter((p) => !selectedIds.has(p.id));
      setProjects(updatedProjects);
      setSelectedProjectScopeId((current) =>
        current && selectedIds.has(current) ? updatedProjects[0]?.id || null : current
      );
      if (selectedProject && selectedIds.has(selectedProject.id)) {
        setSelectedProject(null);
        setProjectSettingsOpen(false);
      }
      toast({ title: `${targets.length} project${targets.length === 1 ? '' : 's'} deleted` });
      exitProjectSelectionMode();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to delete projects.', variant: 'destructive' });
    } finally {
      setBulkProjectDeleteOpen(false);
    }
  };

  const duplicateProject = async (project: Project) => {
    try {
      const newSlug = `${project.slug || 'project'}-copy-${Date.now().toString(36)}`;
      const { data, error } = await createProjectCompat({
        name: `${project.name} (Copy)`,
        description: project.description,
        slug: newSlug,
        owner_id: userId,
        business_id: project.business_id || selectedBusiness?.id || null,
        status: 'draft',
        publish_status: 'draft',
        settings: project.settings,
      });

      if (error) throw error;
      if (!data) throw new Error('Project duplication returned no data.');
      setProjects([data, ...projects]);
      setSelectedProjectScopeId(data.id);
      toast({ title: 'Project duplicated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const openInBuilder = async (project: Project) => {
    // Resolve the matching builder_draft (if any) so the editor opens directly
    // on the user's last saved VFS state instead of a blank canvas.
    let draftId: string | null = project.draft_id || null;
    let revisionId: string | null = project.revision_id || null;
    try {
      if (!project.draft_only) {
        const projection = await findLatestBuilderDraftProjectionForProject({
          projectId: project.id,
          businessId: project.business_id || null,
          userId,
        });
        if (projection) {
          draftId = projection.draftId;
          revisionId = projection.revisionId;
        }
      }
      if (!draftId) {
        draftId = await findBuilderDraftIdForProject({
          projectId: project.draft_only ? null : project.id,
          projectName: project.name,
          businessId: project.business_id || null,
          userId,
        });
      }
    } catch (err) {
      console.warn('[CloudProjects] failed to resolve draft for project', project.id, err);
    }

    if (!project.draft_only && !revisionId) {
      try {
        draftId = await recoverLegacyCloudProject(project.id);
        const conversion = await repairDraftBusinessLink({ draftId, projectId: project.id });
        if (!conversion.revisionId) throw new Error(conversion.notes.join(' ') || 'Saved project conversion could not be accepted.');
        revisionId = conversion.revisionId;
      } catch (error) {
        toast({ title: 'Project recovery needs attention', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
        return;
      }
    }

    const url = draftId ? `/web-builder?id=${draftId}` : '/web-builder';
    navigate(url, {
      state: {
        projectId: project.draft_only ? undefined : project.id,
        draftId,
        businessId: project.business_id || null,
        revisionId,
        projectName: project.name,
        projectSlug: project.slug,
        publishStatus: project.publish_status || project.status,
        from: 'Workspace Settings',
        returnToCloudTab: 'projects',
        returnWorkspaceSection: 'settings',
        returnBusinessId: project.business_id || null,
        returnProjectId: project.id,
      }
    });
  };

  // Inline-rename helper for project cards. Updates `projects.name`; the DB
  // trigger mirrors the change into builder_drafts so headers / lists stay in sync.
  const renameProject = async (project: Project, nextName: string) => {
    const trimmed = nextName.trim();
    if (!trimmed || trimmed === project.name) return;
    try {
      const { renameProjectCompat } = await import('@/services/projectSchemaCompat');
      const { data, error } = await renameProjectCompat(project.id, trimmed);
      if (error) throw error;
      setProjects((current) =>
        current.map((p) => (p.id === project.id ? { ...p, name: data?.name || trimmed } : p)),
      );
      // Broadcast so any open WebBuilder header / BusinessOS shell can refresh.
      try {
        window.dispatchEvent(new CustomEvent('project:renamed', {
          detail: { projectId: project.id, name: trimmed },
        }));
      } catch { /* SSR no-op */ }
      toast({ title: 'Renamed', description: `Project renamed to "${trimmed}".` });
    } catch (error: any) {
      toast({ title: 'Rename failed', description: error.message || 'Could not rename project.', variant: 'destructive' });
    }
  };

  const updateBusinessSetting = (field: keyof typeof businessSettingsForm, value: string) => {
    setBusinessSettingsForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const saveBusinessSettings = async () => {
    if (!selectedBusiness) return;

    const trimmedName = businessSettingsForm.name.trim();
    if (!trimmedName) {
      toast({
        title: 'Business name required',
        description: 'Enter a name before saving business settings.',
        variant: 'destructive',
      });
      return;
    }

    setBusinessSettingsSaving(true);
    try {
      const updates = {
        name: trimmedName,
        website: businessSettingsForm.website.trim() || null,
        industry: businessSettingsForm.industry.trim() || null,
        notification_email: businessSettingsForm.notificationEmail.trim() || null,
        notification_phone: businessSettingsForm.notificationPhone.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('businesses')
        .update(updates)
        .eq('id', selectedBusiness.id)
        .select('*')
        .single();

      if (error) throw error;

      const updatedBusiness = transformBusiness(data);
      setBusinesses((current) =>
        current.map((business) => (business.id === updatedBusiness.id ? updatedBusiness : business))
      );
      setSelectedBusiness(updatedBusiness);

      toast({
        title: 'Business updated',
        description: `${updatedBusiness.name} settings have been saved.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save business settings.',
        variant: 'destructive',
      });
    } finally {
      setBusinessSettingsSaving(false);
    }
  };

  const openProjectSettings = (project: Project) => {
    setSelectedProject(project);
    setSelectedProjectScopeId(project.id);
    setProjectSettingsOpen(true);
  };

  // ==================== FILTERED DATA ====================

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const filteredRecoveredProjects = recoveredProjects.filter((project) =>
    project.name.toLowerCase().includes(recoveredSearchQuery.toLowerCase()) ||
    (project.description?.toLowerCase().includes(recoveredSearchQuery.toLowerCase())),
  );
  const ownedBusinesses = businesses.filter((business) => business.owner_id === userId);
  const selectedOwnedBusinesses = ownedBusinesses.filter((business) => selectedBusinessIds.includes(business.id));
  const allOwnedBusinessesSelected =
    ownedBusinesses.length > 0 && selectedOwnedBusinesses.length === ownedBusinesses.length;
  const selectedBusinessPreview = selectedOwnedBusinesses.slice(0, 3).map((business) => business.name).join(', ');
  
  const selectedScopeProject =
    projects.find((project) => project.id === selectedProjectScopeId) || null;

  // Landing on /crm or /dashboard/leads without an explicit project scope must not
  // strand the user on an empty placeholder — fall back to the first project.
  useEffect(() => {
    if (!selectedScopeProject && projects.length > 0) {
      setSelectedProjectScopeId(projects[0].id);
    }
  }, [selectedScopeProject, projects]);

  const businessSettingsSnapshot =
    selectedBusiness?.settings && typeof selectedBusiness.settings === 'object' && !Array.isArray(selectedBusiness.settings)
      ? (selectedBusiness.settings as Record<string, any>)
      : {};
  const teamSnapshot =
    businessSettingsSnapshot.team &&
    typeof businessSettingsSnapshot.team === 'object' &&
    !Array.isArray(businessSettingsSnapshot.team)
      ? (businessSettingsSnapshot.team as { members?: Array<any>; invitations?: Array<any> })
      : {};
  const teamMemberCount = Array.isArray(teamSnapshot.members) ? teamSnapshot.members.length : 0;
  const pendingInvitationCount = Array.isArray(teamSnapshot.invitations)
    ? teamSnapshot.invitations.filter((invitation) => invitation?.status === 'pending').length
    : 0;
  const businessIdentityFields = [
    selectedBusiness?.name,
    selectedBusiness?.website,
    selectedBusiness?.industry,
    selectedBusiness?.notification_email,
    selectedBusiness?.notification_phone,
  ];
  const businessIdentityCompletion = Math.round(
    (businessIdentityFields.filter((value) => Boolean(String(value || '').trim())).length /
      businessIdentityFields.length) *
      100
  );

  // ==================== LOADING ====================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  // ==================== EMPTY STATE ====================

  if (businesses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 mb-6">
          <Building2 className="h-12 w-12 text-fuchsia-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Create your first business</h2>
        <p className="text-white/40 mb-6 max-w-md">
          Businesses help you organize projects, manage clients, and automate workflows.
        </p>
        <Button 
          onClick={() => setCreateBusinessOpen(true)}
          className="bg-gradient-to-r from-fuchsia-600 to-cyan-600 hover:from-fuchsia-500 hover:to-cyan-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Business
        </Button>

        {/* Create Business Dialog */}
        <Dialog open={createBusinessOpen} onOpenChange={setCreateBusinessOpen}>
          <DialogContent className="bg-[#0d0d18] border-white/10 max-w-md">
            <DialogHeader>
              <DialogTitle>Create Business</DialogTitle>
              <DialogDescription>Give your business a name to get started.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="bizName">Business Name</Label>
              <Input
                id="bizName"
                value={newBusinessName}
                onChange={(e) => setNewBusinessName(e.target.value)}
                placeholder="My Agency"
                className="mt-2 bg-white/[0.03] border-white/10"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateBusinessOpen(false)}>Cancel</Button>
              <Button onClick={createBusiness} disabled={creatingBusiness || !newBusinessName.trim()}>
                {creatingBusiness ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ==================== MAIN LAYOUT ====================

  return (
    <div className="flex h-full min-h-0 gap-6">
      <Dialog open={recoveredProjectsOpen} onOpenChange={setRecoveredProjectsOpen}>
        <DialogContent className="max-w-3xl border-white/10 bg-[#0d0d18]">
          <DialogHeader>
            <DialogTitle>Recovered projects</DialogTitle>
            <DialogDescription>
              {recoveredProjects.length} launcher draft{recoveredProjects.length === 1 ? '' : 's'} ready to open.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={recoveredSearchQuery}
            onChange={(event) => setRecoveredSearchQuery(event.target.value)}
            placeholder="Search recovered projects"
            className="border-white/10 bg-white/[0.03]"
          />
          <ScrollArea className="h-[55vh] pr-4">
            <div className="space-y-2">
              {filteredRecoveredProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{project.name}</p>
                    <ProjectIdChip id={project.id} />
                    <p className="mt-1 text-xs text-white/40">
                      Updated {formatSavedAt(project.updated_at || project.created_at)}
                    </p>
                  </div>
                  {project.preview_ready ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setRecoveredProjectsOpen(false);
                        void openInBuilder(project);
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Open live preview
                    </Button>
                  ) : (
                    <Badge variant="outline" className="border-white/10 text-white/45">
                      Source unavailable
                    </Badge>
                  )}
                </div>
              ))}
              {filteredRecoveredProjects.length === 0 && (
                <p className="py-10 text-center text-sm text-white/45">No recovered projects match this search.</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Left Sidebar - Business List */}
      <aside className="flex w-64 min-h-0 flex-shrink-0 flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-white/40 uppercase tracking-wide">Businesses</h3>
          <div className="flex items-center gap-1">
            {ownedBusinesses.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-7 px-2 text-xs", businessSelectionMode && "bg-white/10 text-white")}
                onClick={() => {
                  if (businessSelectionMode) {
                    exitBusinessSelectionMode();
                    return;
                  }
                  setBusinessSelectionMode(true);
                }}
              >
                {businessSelectionMode ? 'Done' : 'Select'}
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 w-7 p-0"
              onClick={() => setCreateBusinessOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {businessSelectionMode && (
          <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-white">
                  {selectedOwnedBusinesses.length > 0
                    ? `${selectedOwnedBusinesses.length} selected`
                    : 'Select businesses'}
                </p>
                <p className="text-xs text-white/40">
                  Only businesses you own can be deleted in bulk.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                disabled={selectedOwnedBusinesses.length === 0}
                onClick={() => setBulkDeleteConfirmOpen(true)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                className="text-xs text-white/60 transition-colors hover:text-white"
                onClick={() =>
                  setSelectedBusinessIds(
                    allOwnedBusinessesSelected ? [] : ownedBusinesses.map((business) => business.id)
                  )
                }
              >
                {allOwnedBusinessesSelected ? 'Clear selection' : 'Select all owned'}
              </button>
              <span className="text-[11px] text-white/35">{ownedBusinesses.length} owned total</span>
            </div>
          </div>
        )}
        
        <ScrollArea className="flex-1 -mx-2">
          <div className="px-2 space-y-1">
            {businesses.map((business) => (
              <div
                key={business.id}
                onClick={() => {
                  if (businessSelectionMode && business.owner_id === userId) {
                    toggleBusinessSelection(business.id);
                    return;
                  }
                  rememberSelectedBusiness(business.id);
                  setSelectedBusiness(business);
                  setActiveSection('projects');
                }}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  if (businessSelectionMode && business.owner_id === userId) {
                    toggleBusinessSelection(business.id);
                    return;
                  }
                  rememberSelectedBusiness(business.id);
                  setSelectedBusiness(business);
                  setActiveSection('projects');
                }}
                role="button"
                tabIndex={0}
                aria-label={`Open ${business.name}`}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all group",
                  selectedBusiness?.id === business.id
                    ? "bg-white/10 text-white"
                    : "text-white/40 hover:text-white hover:bg-white/5",
                  businessSelectionMode && business.owner_id === userId && selectedBusinessIds.includes(business.id) && "bg-red-500/10 text-white ring-1 ring-red-500/30"
                )}
              >
                {businessSelectionMode && (
                  business.owner_id === userId ? (
                    <Checkbox
                      checked={selectedBusinessIds.includes(business.id)}
                      onCheckedChange={() => toggleBusinessSelection(business.id)}
                      onClick={(event) => event.stopPropagation()}
                      className="border-white/20 data-[state=checked]:border-red-500/70 data-[state=checked]:bg-red-500 data-[state=checked]:text-white"
                    />
                  ) : (
                    <div className="w-4 text-[10px] font-medium uppercase tracking-wide text-white/25">Shared</div>
                  )
                )}
                <div className={cn(
                  "p-1.5 rounded-md transition-colors",
                  selectedBusiness?.id === business.id
                    ? "bg-fuchsia-500/30"
                    : "bg-white/5 group-hover:bg-white/8"
                )}>
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{business.name}</p>
                  {business.last_activity_at && (
                    <p className="truncate text-[10px] text-white/30">
                      Saved {formatSavedAt(business.last_activity_at)}
                    </p>
                  )}
                </div>
                {!businessSelectionMode && business.owner_id === userId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDelete('business', business);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-red-400 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main Content */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {selectedBusiness ? (
          <>
            {/* Business Header & Navigation */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20">
                  <Building2 className="h-5 w-5 text-fuchsia-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{selectedBusiness.name}</h2>
                  <p className="text-sm text-white/30">
                    {projects.length} project{projects.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/web-builder', {
                  state: {
                    businessId: selectedBusiness.id,
                    from: 'Workspace Settings',
                    returnToCloudTab: 'projects',
                    returnWorkspaceSection: 'settings',
                    returnBusinessId: selectedBusiness.id,
                    returnProjectId: selectedProjectScopeId || undefined,
                  },
                })}
              >
                <Paintbrush className="h-4 w-4 mr-2" />
                Open Builder
              </Button>
            </div>

            {/* Section Tabs */}
            <div className="flex items-center gap-1 mb-6 border-b border-white/10 pb-px">
              {[
                { id: 'projects', label: 'Projects', icon: FolderKanban },
                { id: 'crm', label: 'CRM', icon: Users },
                { id: 'automations', label: 'Automations', icon: Zap },
                { id: 'team', label: 'Team', icon: Users },
                { id: 'settings', label: 'Settings', icon: Settings },
                { id: 'database', label: 'Database', icon: Database },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id as BusinessSection)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors relative",
                    activeSection === tab.id
                      ? "text-white bg-white/5"
                      : "text-white/40 hover:text-white"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                  {activeSection === tab.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-500" />
                  )}
                </button>
              ))}
            </div>

            {/* Section Content */}
            <div className="min-h-0 flex-1 overflow-auto">
              {activeSection === 'projects' && (
                <div className="space-y-4">
                  {/* Toolbar */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                      <Input
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-white/[0.03] border-white/10 h-9"
                      />
                    </div>
                    <div className="flex items-center gap-1 border border-white/10 rounded-lg p-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-7 px-2", viewMode === 'grid' && "bg-white/10")}
                        onClick={() => setViewMode('grid')}
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("h-7 px-2", viewMode === 'list' && "bg-white/10")}
                        onClick={() => setViewMode('list')}
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                    {recoveredProjects.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-amber-500/30 text-amber-200 hover:bg-amber-500/10 hover:text-amber-100"
                        onClick={() => setRecoveredProjectsOpen(true)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Recovered {recoveredProjects.length}
                      </Button>
                    )}
                    {projectSelectionMode ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setSelectedProjectIds(
                          selectedProjectIds.length === filteredProjects.length ? [] : filteredProjects.map((p) => p.id)
                        )}>
                          {selectedProjectIds.length === filteredProjects.length && filteredProjects.length > 0 ? 'Clear all' : 'Select all'}
                        </Button>
                        <Button variant="destructive" size="sm" disabled={selectedProjectIds.length === 0} onClick={() => setBulkProjectDeleteOpen(true)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete {selectedProjectIds.length || ''}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={exitProjectSelectionMode}>Cancel</Button>
                      </>
                    ) : filteredProjects.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => setProjectSelectionMode(true)}>
                        Select
                      </Button>
                    )}
                    <Button variant="outline" disabled={migrationProgress !== null} onClick={() => void restoreCloudProjects()}>
                      {migrationProgress ? `Restoring ${migrationProgress.completed}/${migrationProgress.total}` : 'Restore older projects'}
                    </Button>
                    <Button onClick={() => setCreateProjectOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      New Project
                    </Button>
                  </div>

                  {migrationResults && <div role="status" className="mb-4 text-sm">
                    <p>{migrationResults.filter(result => result.converted).length} projects restored. {migrationResults.filter(result => !result.converted).length} need attention.</p>
                    {migrationResults.some(result => !result.converted) && <details><summary>View projects needing attention</summary>
                      <ul>{migrationResults.filter(result => !result.converted).map((result, index) => <li key={result.draftId || index}>{result.draftId || result.projectId}: {result.notes.join(' ')}</li>)}</ul>
                    </details>}
                  </div>}
                  {/* Projects */}
                  {filteredProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="p-4 rounded-2xl bg-white/[0.03] mb-4">
                        <Rocket className="h-10 w-10 text-white/30" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        {searchQuery ? 'No projects found' : 'Create your first project'}
                      </h3>
                      <p className="text-white/40 text-sm mb-4">
                        {searchQuery 
                          ? 'Try a different search term.' 
                          : 'Start building something amazing.'}
                      </p>
                      {!searchQuery && (
                        <Button onClick={() => setCreateProjectOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          New Project
                        </Button>
                      )}
                    </div>
                  ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filteredProjects.map((project) => (
                        <Card 
                          key={project.id}
                          className={cn(
                            "bg-white/[0.02] border-white/5 hover:border-cyan-500/30 transition-all group cursor-pointer",
                            projectSelectionMode && selectedProjectIds.includes(project.id) && "border-red-500/50 ring-1 ring-red-500/30"
                          )}
                          onClick={() => projectSelectionMode ? toggleProjectSelection(project.id) : openInBuilder(project)}
                        >
                          {/* Thumbnail */}
                          <div className="relative h-32 bg-gradient-to-br from-white/[0.04] to-white/[0.01] flex items-center justify-center border-b border-white/5">
                            {projectSelectionMode && (
                              <Checkbox
                                className="absolute left-3 top-3"
                                checked={selectedProjectIds.includes(project.id)}
                                onClick={(e) => e.stopPropagation()}
                                onCheckedChange={() => toggleProjectSelection(project.id)}
                                aria-label={`Select ${project.name}`}
                              />
                            )}
                            <Palette className="h-8 w-8 text-white/20" />
                          </div>
                          
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <h4 className="font-semibold truncate group-hover:text-cyan-300 transition-colors">
                                  {project.name}
                                </h4>
                                <p className="text-xs text-white/30 font-mono">/{project.slug}</p>
                                <ProjectIdChip id={project.id} />
                              </div>
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs shrink-0",
                                  project.status === 'published' 
                                    ? "text-cyan-400 border-cyan-500/30" 
                                    : "text-amber-400 border-amber-500/30"
                                )}
                              >
                                {project.status === 'published' ? 'Live' : 'Draft'}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-2 mt-3 text-xs text-white/30">
                              <Clock className="h-3 w-3" />
                              {formatSavedAt(project.updated_at || project.created_at)}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5" onClick={(e) => e.stopPropagation()}>
                              <Button 
                                size="sm" 
                                variant="secondary"
                                className="flex-1 h-8 text-xs"
                                onClick={() => openInBuilder(project)}
                              >
                                <Edit3 className="h-3 w-3 mr-1.5" />
                                Edit
                              </Button>
                              {project.status === 'published' && (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 w-8 p-0"
                                  onClick={() => window.open(`/preview/${project.slug}`, '_blank')}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-[#0d0d18] border-white/10 w-40">
                                  <DropdownMenuItem onSelect={() => duplicateProject(project)}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Duplicate
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => {
                                    const next = window.prompt('Rename project', project.name);
                                    if (next != null) renameProject(project, next);
                                  }}>
                                    <Edit3 className="h-4 w-4 mr-2" />
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onSelect={() => {
                                    openProjectSettings(project);
                                  }}>
                                    <Settings className="h-4 w-4 mr-2" />
                                    Settings
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-white/10" />
                                  <DropdownMenuItem 
                                    className="text-red-400 focus:text-red-400"
                                    onSelect={() => confirmDelete('project', project)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    /* List View */
                    <div className="border border-white/10 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/[0.02]">
                            <th className="text-left text-xs font-medium text-white/40 uppercase tracking-wider px-4 py-3">Name</th>
                            <th className="text-left text-xs font-medium text-white/40 uppercase tracking-wider px-4 py-3">Status</th>
                            <th className="text-left text-xs font-medium text-white/40 uppercase tracking-wider px-4 py-3">Updated</th>
                            <th className="text-right text-xs font-medium text-white/40 uppercase tracking-wider px-4 py-3">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredProjects.map((project) => (
                            <tr 
                              key={project.id} 
                              className={cn("hover:bg-white/5 cursor-pointer", projectSelectionMode && selectedProjectIds.includes(project.id) && "bg-red-500/10")}
                              onClick={() => projectSelectionMode ? toggleProjectSelection(project.id) : openInBuilder(project)}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  {projectSelectionMode && (
                                    <Checkbox
                                      checked={selectedProjectIds.includes(project.id)}
                                      onClick={(e) => e.stopPropagation()}
                                      onCheckedChange={() => toggleProjectSelection(project.id)}
                                      aria-label={`Select ${project.name}`}
                                    />
                                  )}
                                <div>
                                  <p className="font-medium">{project.name}</p>
                                  <p className="text-xs text-white/30 font-mono">/{project.slug}</p>
                                  <ProjectIdChip id={project.id} />
                                </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-xs",
                                    project.status === 'published' 
                                      ? "text-cyan-400 border-cyan-500/30" 
                                      : "text-amber-400 border-amber-500/30"
                                  )}
                                >
                                  {project.status === 'published' ? 'Live' : 'Draft'}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-sm text-white/40">
                                {formatSavedAt(project.updated_at || project.created_at)}
                              </td>
                              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  <Button size="sm" variant="ghost" className="h-7" onClick={() => openInBuilder(project)}>
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7"
                                    title="Rename project"
                                    onClick={() => {
                                      const next = window.prompt('Rename project', project.name);
                                      if (next != null) renameProject(project, next);
                                    }}
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7"
                                    onClick={() => openProjectSettings(project)}
                                  >
                                    <Settings className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    onClick={() => confirmDelete('project', project)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {activeSection === 'crm' && (
                <div className="space-y-6">
                  <Card className="bg-white/[0.02] border-white/5">
                    <CardHeader className="pb-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">
                              Project CRM Scope
                            </Badge>
                            <Badge variant="outline" className="border-white/10 text-white/50">
                              Business: {selectedBusiness.name}
                            </Badge>
                            {selectedScopeProject && (
                              <Badge variant="outline" className="border-fuchsia-500/30 text-fuchsia-300">
                                Project: {selectedScopeProject.name}
                              </Badge>
                            )}
                          </div>
                          <div>
                            <CardTitle>Project Workspace</CardTitle>
                            <CardDescription>
                              CRM records, pipeline activity, workflows, and forms now stay inside one project workspace instead of leaking across the entire business.
                            </CardDescription>
                          </div>
                        </div>
                        {selectedScopeProject && (
                          <Button
                            variant="outline"
                            className="border-white/10"
                            onClick={() => openProjectSettings(selectedScopeProject)}
                          >
                            <Settings className="mr-2 h-4 w-4" />
                            Project Settings
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {projects.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {projects.map((project) => (
                            <Button
                              key={project.id}
                              variant={selectedProjectScopeId === project.id ? 'secondary' : 'outline'}
                              className={cn(
                                "justify-start border-white/10",
                                selectedProjectScopeId === project.id
                                  ? "bg-white/10 text-white"
                                  : "text-white/60 hover:text-white"
                              )}
                              onClick={() => setSelectedProjectScopeId(project.id)}
                            >
                              <FolderKanban className="mr-2 h-4 w-4" />
                              {project.name}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-sm text-white/50">
                          Create a project first. CRM is now project-scoped, so there is no business-wide fallback view here.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {selectedScopeProject ? (
                    <CRMDashboard
                      embedded
                      businessId={selectedBusiness.id}
                      projectId={selectedScopeProject.id}
                      siteId={selectedScopeProject.site_id ?? undefined}
                      initialView={crmView}
                    />
                  ) : (
                    <Card className="bg-white/[0.02] border-white/5">
                      <CardContent className="py-12 text-center text-white/40">
                        Select a project workspace to open CRM.
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {activeSection === 'automations' && (
                <div className="space-y-6">
                  <Card className="bg-white/[0.02] border-white/5">
                    <CardHeader>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">
                          Business Defaults
                        </Badge>
                        <Badge variant="outline" className="border-fuchsia-500/30 text-fuchsia-300">
                          Project Workspace
                        </Badge>
                      </div>
                      <CardTitle>Automation Scope</CardTitle>
                      <CardDescription>
                        Business automation settings define shared guardrails and recipe packs. Project settings define how one workspace applies CRM stages, follow-ups, notifications, and local automation behavior.
                      </CardDescription>
                    </CardHeader>
                  </Card>

                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
                    <div className="min-w-0">
                      <BusinessAutomationSettings
                        businessId={selectedBusiness.id}
                        businessIndustry={selectedBusiness.industry}
                        projectId={selectedScopeProject?.id ?? ""}
                        siteId={selectedScopeProject?.site_id ?? null}
                        siteProjects={projects
                          .filter((project) => Boolean(project.site_id))
                          .map((project) => ({ id: project.id, name: project.name }))}
                        onSelectProject={setSelectedProjectScopeId}
                      />
                    </div>

                    <Card className="bg-white/[0.02] border-white/5 h-fit">
                      <CardHeader>
                        <CardTitle>Project Workspace Settings</CardTitle>
                        <CardDescription>
                          Choose a project and open its dedicated settings panel. These settings do not overwrite the business default automation profile.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {projects.length > 0 ? (
                          <>
                            <div className="space-y-2">
                              {projects.map((project) => (
                                <button
                                  key={project.id}
                                  type="button"
                                  onClick={() => setSelectedProjectScopeId(project.id)}
                                  className={cn(
                                    "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                                    selectedProjectScopeId === project.id
                                      ? "border-cyan-500/40 bg-cyan-500/10"
                                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.04]"
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="font-medium text-white">{project.name}</p>
                                      <p className="text-xs text-white/40 font-mono">/{project.slug}</p>
                                    </div>
                                    {selectedProjectScopeId === project.id && (
                                      <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">
                                        Active
                                      </Badge>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                              <p className="text-sm font-medium text-white">
                                {selectedScopeProject ? selectedScopeProject.name : 'No project selected'}
                              </p>
                              <p className="mt-1 text-sm text-white/50">
                                Project settings cover CRM stages, lead routing, project-specific automation toggles, notifications, analytics, and domain-level workspace behavior.
                              </p>
                            </div>
                            <Button
                              className="w-full"
                              disabled={!selectedScopeProject}
                              onClick={() => selectedScopeProject && openProjectSettings(selectedScopeProject)}
                            >
                              <Settings className="mr-2 h-4 w-4" />
                              Open Project Settings
                            </Button>
                          </>
                        ) : (
                          <div className="rounded-lg border border-dashed border-white/10 px-4 py-6 text-sm text-white/50">
                            Create a project before configuring project-level automations.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {activeSection === 'team' && (
                <CloudTeams userId={userId} organizationId={selectedBusiness.id} />
              )}

              {activeSection === 'settings' && (
                <div className="space-y-8">
                  <Card className="relative overflow-hidden border-white/10 bg-white/[0.03]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.18),transparent_30%)]" />
                    <CardContent className="relative p-6 sm:p-8">
                      <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
                        <div className="max-w-3xl space-y-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                              Business Layer
                            </Badge>
                            <Badge variant="outline" className="border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300">
                              Project Layer
                            </Badge>
                            <Badge variant="outline" className="border-white/10 text-white/50">
                              Infrastructure-aligned
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-2xl font-semibold text-white sm:text-3xl">
                              Cloud Settings Control Center
                            </h3>
                            <p className="max-w-2xl text-sm leading-6 text-white/60 sm:text-base">
                              This settings surface now mirrors the actual platform architecture. Business identity, ownership, and automation defaults live once at the business level. CRM behavior, workflow behavior, and operational overrides live inside each project workspace.
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {[
                            {
                              label: 'Projects',
                              value: String(projects.length),
                              icon: FolderKanban,
                              tone: 'from-cyan-500/20 to-cyan-500/5 text-cyan-300',
                            },
                            {
                              label: 'Team Members',
                              value: String(teamMemberCount),
                              icon: Users,
                              tone: 'from-fuchsia-500/20 to-fuchsia-500/5 text-fuchsia-300',
                            },
                            {
                              label: 'Pending Invites',
                              value: String(pendingInvitationCount),
                              icon: ChevronRight,
                              tone: 'from-amber-500/20 to-amber-500/5 text-amber-300',
                            },
                            {
                              label: 'Identity Ready',
                              value: `${businessIdentityCompletion}%`,
                              icon: Building2,
                              tone: 'from-lime-500/20 to-lime-500/5 text-lime-300',
                            },
                          ].map((item) => (
                            <div
                              key={item.label}
                              className="min-w-[132px] rounded-2xl border border-white/10 bg-black/20 p-4 backdrop-blur-sm"
                            >
                              <div className={cn("mb-3 inline-flex rounded-xl bg-gradient-to-br p-2", item.tone)}>
                                <item.icon className="h-4 w-4" />
                              </div>
                              <p className="text-xl font-semibold text-white">{item.value}</p>
                              <p className="text-xs uppercase tracking-[0.18em] text-white/35">{item.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.95fr)]">
                    <Card className="border-white/5 bg-white/[0.02]">
                      <CardHeader className="space-y-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <CardTitle>Business Identity</CardTitle>
                            <CardDescription>
                              Shared brand, website, industry, and notification ownership for {selectedBusiness.name}.
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className="w-fit border-white/10 text-white/50">
                            {businessIdentityCompletion}% complete
                          </Badge>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-lime-400 transition-all"
                            style={{ width: `${businessIdentityCompletion}%` }}
                          />
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2 md:col-span-2">
                            <Label>Business Name</Label>
                            <Input
                              value={businessSettingsForm.name}
                              onChange={(event) => updateBusinessSetting('name', event.target.value)}
                              placeholder="Studio name, agency name, or operating entity"
                              className="h-11 border-white/10 bg-white/[0.03]"
                            />
                            <p className="text-xs text-white/35">
                              This appears across shared business surfaces and ownership-aware workflows.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label>Website</Label>
                            <Input
                              value={businessSettingsForm.website}
                              onChange={(event) => updateBusinessSetting('website', event.target.value)}
                              placeholder="https://example.com"
                              className="h-11 border-white/10 bg-white/[0.03]"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Industry</Label>
                            <Input
                              value={businessSettingsForm.industry}
                              onChange={(event) => updateBusinessSetting('industry', event.target.value)}
                              placeholder="Agency, ecommerce, salon..."
                              className="h-11 border-white/10 bg-white/[0.03]"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Notification Email</Label>
                            <Input
                              value={businessSettingsForm.notificationEmail}
                              onChange={(event) => updateBusinessSetting('notificationEmail', event.target.value)}
                              placeholder="ops@example.com"
                              className="h-11 border-white/10 bg-white/[0.03]"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Notification Phone</Label>
                            <Input
                              value={businessSettingsForm.notificationPhone}
                              onChange={(event) => updateBusinessSetting('notificationPhone', event.target.value)}
                              placeholder="+1 (555) 555-5555"
                              className="h-11 border-white/10 bg-white/[0.03]"
                            />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="text-sm font-medium text-white">What belongs in this layer</p>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            {[
                              'Business name, site, and industry',
                              'Shared notification ownership',
                              'Team and access routing',
                              'Defaults that every project can inherit',
                            ].map((item) => (
                              <div key={item} className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-white/55">
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                          <Button
                            variant="outline"
                            className="border-white/10"
                            onClick={() =>
                              setBusinessSettingsForm({
                                name: selectedBusiness.name || '',
                                website: selectedBusiness.website || '',
                                industry: selectedBusiness.industry || '',
                                notificationEmail: selectedBusiness.notification_email || '',
                                notificationPhone: selectedBusiness.notification_phone || '',
                              })
                            }
                          >
                            Reset
                          </Button>
                          <div className="flex flex-col gap-3 sm:flex-row">
                            <Button
                              variant="outline"
                              className="border-white/10"
                              onClick={() => setActiveSection('team')}
                            >
                              <Users className="mr-2 h-4 w-4" />
                              Review Team Access
                            </Button>
                            <Button onClick={saveBusinessSettings} disabled={businessSettingsSaving}>
                              {businessSettingsSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Save Business Identity
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                          <p className="text-sm font-semibold text-red-300">Danger Zone</p>
                          <p className="mt-1 text-sm text-white/45">
                            Deleting the business removes the shared parent container for every project workspace in this account.
                          </p>
                          {selectedBusiness.owner_id === userId ? (
                            <Button
                              variant="destructive"
                              size="sm"
                              className="mt-4"
                              onClick={() => confirmDelete('business', selectedBusiness)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Business
                            </Button>
                          ) : (
                            <p className="mt-4 text-xs text-white/40">
                              Only the business owner can delete this shared workspace.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <div className="space-y-6">
                      <Card className="border-white/5 bg-white/[0.02]">
                        <CardHeader>
                          <CardTitle>Scope Map</CardTitle>
                          <CardDescription>
                            A quick read on where the platform expects each setting to live.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-cyan-300" />
                              <p className="font-medium text-cyan-200">Business Layer</p>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-white/55">
                              Identity, owner-level notifications, shared team, and automation defaults should be edited once here and inherited intentionally.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-cyan-500/20 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15"
                                onClick={() => setActiveSection('automations')}
                              >
                                <Zap className="mr-2 h-4 w-4" />
                                Automation Defaults
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-cyan-500/20 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/15"
                                onClick={() => setActiveSection('team')}
                              >
                                <Users className="mr-2 h-4 w-4" />
                                Team & Roles
                              </Button>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-4">
                            <div className="flex items-center gap-2">
                              <FolderKanban className="h-4 w-4 text-fuchsia-300" />
                              <p className="font-medium text-fuchsia-200">Project Layer</p>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-white/55">
                              CRM records, pipeline behavior, forms, workflow execution, domain behavior, and local automation overrides stay in a single project workspace.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/15"
                                onClick={() => setActiveSection('crm')}
                              >
                                <BarChart3 className="mr-2 h-4 w-4" />
                                Open CRM Scope
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/15"
                                onClick={() => selectedScopeProject && openProjectSettings(selectedScopeProject)}
                                disabled={!selectedScopeProject}
                              >
                                <Settings className="mr-2 h-4 w-4" />
                                Project Settings
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-white/5 bg-white/[0.02]">
                        <CardHeader>
                          <CardTitle>Current Workspace</CardTitle>
                          <CardDescription>
                            Keep one project selected while tuning scoped CRM and automation behavior.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm text-white/35">Active project workspace</p>
                                <p className="mt-1 text-lg font-semibold text-white">
                                  {selectedScopeProject?.name || 'No project selected'}
                                </p>
                                <p className="mt-1 text-sm text-white/45">
                                  {selectedScopeProject
                                    ? `/${selectedScopeProject.slug || selectedScopeProject.id}`
                                    : 'Choose a project below to open workspace-level settings.'}
                                </p>
                              </div>
                              {selectedScopeProject && (
                                <Badge variant="outline" className="border-lime-500/30 text-lime-300">
                                  Active Scope
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                              <p className="text-xs uppercase tracking-[0.18em] text-white/35">Inherited from Business</p>
                              <p className="mt-2 text-sm leading-6 text-white/55">
                                Branding context, notification ownership, team access model, and automation guardrails.
                              </p>
                            </div>
                            <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                              <p className="text-xs uppercase tracking-[0.18em] text-white/35">Owned by Project</p>
                              <p className="mt-2 text-sm leading-6 text-white/55">
                                Pipeline stages, forms, workflow activity, workspace notifications, analytics, and domain behavior.
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3">
                            <Button
                              className="w-full"
                              disabled={!selectedScopeProject}
                              onClick={() => selectedScopeProject && openProjectSettings(selectedScopeProject)}
                            >
                              <Settings className="mr-2 h-4 w-4" />
                              Open Active Project Settings
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full border-white/10"
                              disabled={!selectedScopeProject}
                              onClick={() => setActiveSection('crm')}
                            >
                              <Workflow className="mr-2 h-4 w-4" />
                              Work Inside CRM Scope
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>

                  <Card className="border-white/5 bg-white/[0.02]">
                    <CardHeader>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <CardTitle>Project Workspace Library</CardTitle>
                          <CardDescription>
                            Each project is an isolated operating space with its own CRM, workflows, and local automation behavior.
                          </CardDescription>
                        </div>
                        <Button onClick={() => setCreateProjectOpen(true)}>
                          <Plus className="mr-2 h-4 w-4" />
                          New Project
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {projects.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {projects.map((project) => {
                            const isActiveScope = selectedProjectScopeId === project.id;

                            return (
                              <div
                                key={project.id}
                                className={cn(
                                  "rounded-2xl border p-5 transition-colors",
                                  isActiveScope
                                    ? "border-cyan-500/30 bg-cyan-500/10"
                                    : "border-white/8 bg-black/20 hover:bg-white/[0.03]"
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-lg font-semibold text-white">{project.name}</p>
                                    <p className="text-xs font-mono text-white/35">/{project.slug}</p>
                                  </div>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      isActiveScope
                                        ? "border-cyan-500/30 text-cyan-300"
                                        : "border-white/10 text-white/45"
                                    )}
                                  >
                                    {isActiveScope ? 'Active Scope' : 'Project'}
                                  </Badge>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                  <Badge variant="outline" className="border-white/10 text-white/50">
                                    CRM scoped
                                  </Badge>
                                  <Badge variant="outline" className="border-white/10 text-white/50">
                                    Forms isolated
                                  </Badge>
                                  <Badge variant="outline" className="border-white/10 text-white/50">
                                    Workflow local
                                  </Badge>
                                </div>

                                <p className="mt-4 text-sm leading-6 text-white/50">
                                  Use this workspace when you want separate leads, separate pipeline activity, and separate automation behavior from the rest of the business.
                                </p>

                                <div className="mt-5 flex gap-2">
                                  <Button
                                    variant={isActiveScope ? 'secondary' : 'outline'}
                                    className={cn("flex-1", !isActiveScope && "border-white/10")}
                                    onClick={() => setSelectedProjectScopeId(project.id)}
                                  >
                                    {isActiveScope ? 'Selected' : 'Select'}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => openProjectSettings(project)}
                                  >
                                    <Settings className="mr-2 h-4 w-4" />
                                    Settings
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 px-6 py-12 text-center">
                          <div className="mx-auto mb-4 inline-flex rounded-2xl bg-white/[0.04] p-4">
                            <FolderKanban className="h-8 w-8 text-white/30" />
                          </div>
                          <p className="text-lg font-semibold text-white">No project workspaces yet</p>
                          <p className="mt-2 text-sm text-white/45">
                            Create the first project to unlock isolated CRM, automation, and workspace settings.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="grid gap-6 lg:grid-cols-3">
                    <Card className="border-white/5 bg-white/[0.02]">
                      <CardHeader>
                        <CardTitle className="text-base">Automation Defaults</CardTitle>
                        <CardDescription>
                          Configure sender identity, timing, consent, and recipe packs once for this business.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button
                          variant="outline"
                          className="w-full border-white/10"
                          onClick={() => setActiveSection('automations')}
                        >
                          <Zap className="mr-2 h-4 w-4" />
                          Open Automation Defaults
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="border-white/5 bg-white/[0.02]">
                      <CardHeader>
                        <CardTitle className="text-base">Team & Access</CardTitle>
                        <CardDescription>
                          Review who can operate this business container and who is still pending invitation.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button
                          variant="outline"
                          className="w-full border-white/10"
                          onClick={() => setActiveSection('team')}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          Open Team Management
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className="border-white/5 bg-white/[0.02]">
                      <CardHeader>
                        <CardTitle className="text-base">Project CRM Scope</CardTitle>
                        <CardDescription>
                          Jump directly into the currently selected project workspace and manage live CRM activity there.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Button
                          variant="outline"
                          className="w-full border-white/10"
                          onClick={() => setActiveSection('crm')}
                          disabled={!selectedScopeProject}
                        >
                          <BarChart3 className="mr-2 h-4 w-4" />
                          Open Active Workspace
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {activeSection === 'database' && (
                <CloudDatabase
                  businessId={selectedBusiness.id}
                  businessName={selectedBusiness.name}
                  projectId={selectedScopeProject?.id ?? null}
                  projectName={selectedScopeProject?.name ?? 'No project selected'}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-white/40">
            Select a business to manage
          </div>
        )}
      </main>

      {/* Dialogs */}
      <Dialog open={createBusinessOpen} onOpenChange={setCreateBusinessOpen}>
        <DialogContent className="bg-[#0d0d18] border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle>Create Business</DialogTitle>
            <DialogDescription>Give your business a name.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="newBizName">Business Name</Label>
            <Input
              id="newBizName"
              value={newBusinessName}
              onChange={(e) => setNewBusinessName(e.target.value)}
              placeholder="My Agency"
              className="mt-2 bg-white/[0.03] border-white/10"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateBusinessOpen(false)}>Cancel</Button>
            <Button onClick={createBusiness} disabled={creatingBusiness || !newBusinessName.trim()}>
              {creatingBusiness ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
        <DialogContent className="bg-[#0d0d18] border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Create a new project in {selectedBusiness?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="projName">Project Name</Label>
              <Input
                id="projName"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="My Website"
                className="mt-2 bg-white/[0.03] border-white/10"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="projDesc">Description (optional)</Label>
              <Input
                id="projDesc"
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="A brief description..."
                className="mt-2 bg-white/[0.03] border-white/10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateProjectOpen(false)}>Cancel</Button>
            <Button onClick={createProject} disabled={creatingProject || !newProjectName.trim()}>
              {creatingProject ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="bg-[#0d0d18] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{itemToDelete?.item && 'name' in itemToDelete.item ? itemToDelete.item.name : ''}". 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent className="bg-[#0d0d18] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected businesses?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedOwnedBusinesses.length} business{selectedOwnedBusinesses.length === 1 ? '' : 'es'}
              {selectedBusinessPreview ? ` including ${selectedBusinessPreview}` : ''}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeBulkDeleteBusinesses} className="bg-red-600 hover:bg-red-700">
              Delete Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkProjectDeleteOpen} onOpenChange={setBulkProjectDeleteOpen}>
        <AlertDialogContent className="bg-[#0d0d18] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected projects?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedProjectIds.length} project{selectedProjectIds.length === 1 ? '' : 's'}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeBulkDeleteProjects} className="bg-red-600 hover:bg-red-700">
              Delete Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <ProjectSettingsPanel
        projectId={selectedProject?.id || ''}
        open={projectSettingsOpen}
        onOpenChange={(open) => {
          setProjectSettingsOpen(open);
          if (!open) {
            setSelectedProject(null);
          }
        }}
      />
    </div>
  );
}
