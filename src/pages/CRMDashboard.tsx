import { useEffect, useState } from "react";
import { 
  Users, 
  Target, 
  Workflow, 
  FileText, 
  BarChart3, 
  Activity as ActivityIcon,
  BriefcaseBusiness,
  Menu,
  X,
  Kanban,
  Zap,
  Sparkles,
  Calendar,
  Package,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CRMContacts } from "@/components/crm/CRMContacts";
import { CRMLeads } from "@/components/crm/CRMLeads";
import { CRMWorkflows } from "@/components/crm/CRMWorkflows";
import { CRMFormSubmissions } from "@/components/crm/CRMFormSubmissions";
import { CRMOverview } from "@/components/crm/CRMOverview";
import { CRMPipeline } from "@/components/crm/CRMPipeline";
import { CRMAutomations } from "@/components/crm/CRMAutomations";
import { PrebuiltWorkflows } from "@/components/crm/PrebuiltWorkflows";
import { CRMBookings } from "@/components/crm/CRMBookings";
import { CRMActivityFeed } from "@/components/crm/CRMActivityFeed";
import { BusinessCatalogEditor } from '@/components/business-center/BusinessCatalogEditor';
import {
  getCRMNavigationItems,
  loadInstalledSiteCapabilities,
  resolveVisibleCRMView,
  type CRMView,
} from '@/services/crmWorkspaceCapabilities';

export type { CRMView } from '@/services/crmWorkspaceCapabilities';

const CRM_VIEW_ICONS = {
  overview: BarChart3,
  contacts: Users,
  activity: ActivityIcon,
  automations: Zap,
  leads: Target,
  bookings: Calendar,
  services: BriefcaseBusiness,
  products: Package,
  menu: Utensils,
  pipeline: Kanban,
  workflows: Workflow,
  recipes: Sparkles,
  forms: FileText,
} satisfies Record<CRMView, typeof BarChart3>;

interface CRMDashboardProps {
  initialView?: CRMView;
  businessId: string;
  projectId: string;
  siteId?: string;
  embedded?: boolean;
}

export default function CRMDashboard({
  initialView = "overview",
  businessId,
  projectId,
  siteId,
  embedded = false,
}: CRMDashboardProps) {
  const [activeView, setActiveView] = useState<CRMView>(initialView);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [installedCapabilities, setInstalledCapabilities] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!siteId) {
      setInstalledCapabilities([]);
      return;
    }
    void loadInstalledSiteCapabilities({ businessId, projectId, siteId })
      .then((capabilities) => { if (!cancelled) setInstalledCapabilities(capabilities); })
      .catch((error) => {
        console.warn('[CRMDashboard] Site capability load failed; showing core CRM only.', error);
        if (!cancelled) setInstalledCapabilities([]);
      });
    return () => { cancelled = true; };
  }, [businessId, projectId, siteId]);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  useEffect(() => {
    if (installedCapabilities === null) return;
    if (!resolveVisibleCRMView(activeView, installedCapabilities)) setActiveView('overview');
  }, [activeView, installedCapabilities]);

  const navItems = getCRMNavigationItems(installedCapabilities ?? []);
  const visibleView = resolveVisibleCRMView(activeView, installedCapabilities ?? []);

  const selectView = (view: CRMView) => {
    setActiveView(view);
  };

  const renderContent = () => {
    switch (visibleView) {
      case "contacts":
        return <CRMContacts businessId={businessId} projectId={projectId} />;
      case "activity":
        return <CRMActivityFeed businessId={businessId} />;
      case "leads":
        return <CRMLeads businessId={businessId} projectId={projectId} />;
      case "bookings":
        return <CRMBookings businessId={businessId} projectId={projectId} />;
      case "services":
        return <BusinessCatalogEditor sectionType="ServiceGrid" businessId={businessId} projectId={projectId} siteId={siteId} />;
      case "products":
        return <BusinessCatalogEditor sectionType="ProductGrid" businessId={businessId} projectId={projectId} siteId={siteId} />;
      case "menu":
        return <BusinessCatalogEditor sectionType="MenuSection" businessId={businessId} projectId={projectId} siteId={siteId} />;
      case "pipeline":
        return <CRMPipeline businessId={businessId} projectId={projectId} />;
      case "workflows":
        return <CRMWorkflows businessId={businessId} projectId={projectId} />;
      case "recipes":
        return <PrebuiltWorkflows businessId={businessId} />;
      case "automations":
        return <CRMAutomations businessId={businessId} projectId={projectId} />;
      case "forms":
        return <CRMFormSubmissions businessId={businessId} projectId={projectId} />;
      default:
        return (
          <CRMOverview
            businessId={businessId}
            projectId={projectId}
            onNavigate={selectView}
          />
        );
    }
  };

  return (
    <div className={cn("bg-background flex", embedded ? "min-h-[36rem]" : "min-h-screen")}>
      {/* Sidebar */}
      <aside
        className={cn(
          "bg-card border-r border-border transition-all duration-300 flex flex-col",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Header */}
        <div className="h-16 border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-2">
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-base text-foreground">CRM</h1>
                {embedded && <p className="text-[11px] text-muted-foreground">Project workspace</p>}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={visibleView === item.id ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                !sidebarOpen && "justify-center px-2"
              )}
              onClick={() => selectView(item.id)}
            >
              {(() => {
                const Icon = CRM_VIEW_ICONS[item.id];
                return <Icon className={cn("h-4 w-4", sidebarOpen && "mr-2")} />;
              })()}
              {sidebarOpen && <span>{item.label}</span>}
            </Button>
          ))}
        </nav>

      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground capitalize">
              {navItems.find((item) => item.id === visibleView)?.label ?? visibleView}
            </h2>
          </div>
          <div className="text-xs text-muted-foreground">
            {projectId ? "Project scoped" : businessId ? "Business scoped" : "Workspace scope required"}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
