import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, Workflow, FileText, TrendingUp, Clock, Kanban } from "lucide-react";
import { supabase as _sb } from "@/integrations/supabase/client";
const supabase: any = _sb;
import { WorkflowActivityFeed } from "./WorkflowActivityFeed";
import { GhlReactionsManager } from "./GhlReactionsManager";
import { CRMActivityFeed } from "./CRMActivityFeed";


interface OverviewStats {
  contacts: number;
  leads: number;
  deals: number;
  workflows: number;
  submissions: number;
  recentLeads: any[];
  recentSubmissions: any[];
}

interface CRMOverviewProps {
  onNavigate: (view: "contacts" | "leads" | "pipeline" | "workflows" | "automations" | "forms") => void;
  businessId?: string;
  projectId?: string;
}

export function CRMOverview({ onNavigate, businessId, projectId }: CRMOverviewProps) {
  const [stats, setStats] = useState<OverviewStats>({
    contacts: 0,
    leads: 0,
    deals: 0,
    workflows: 0,
    submissions: 0,
    recentLeads: [],
    recentSubmissions: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        if (!businessId && !projectId) {
          setStats({
            contacts: 0,
            leads: 0,
            deals: 0,
            workflows: 0,
            submissions: 0,
            recentLeads: [],
            recentSubmissions: [],
          });
          return;
        }

        let contactsQuery = supabase.from("crm_contacts").select("id", { count: "exact", head: true });
        let leadsQuery = supabase.from("crm_leads").select("*").order("created_at", { ascending: false }).limit(5);
        let submissionsQuery = supabase.from("crm_form_submissions").select("*").order("created_at", { ascending: false }).limit(5);
        let scopeColumn = "project_id";
        let scopeId = projectId;
        let contactRowsQuery = supabase.from("crm_contacts").select("id");

        if (projectId) {
          if (businessId) {
            const sharedContactFilter = `project_id.eq.${projectId},project_id.is.null`;
            contactsQuery = contactsQuery.eq("business_id", businessId).or(sharedContactFilter);
            contactRowsQuery = contactRowsQuery.eq("business_id", businessId).or(sharedContactFilter);
          } else {
            contactsQuery = contactsQuery.eq("project_id", projectId);
            contactRowsQuery = contactRowsQuery.eq("project_id", projectId);
          }
          leadsQuery = leadsQuery.eq("project_id", projectId);
          submissionsQuery = submissionsQuery.eq("project_id", projectId);
        } else if (businessId) {
          scopeColumn = "business_id";
          scopeId = businessId;
          contactsQuery = contactsQuery.eq("business_id", businessId);
          contactRowsQuery = contactRowsQuery.eq("business_id", businessId);
          leadsQuery = leadsQuery.eq("business_id", businessId);
          submissionsQuery = submissionsQuery.eq("business_id", businessId);
        }

        const [contactRows, leadRows] = await Promise.all([
          contactRowsQuery,
          supabase.from("crm_leads").select("id").eq(scopeColumn, scopeId),
        ]);
        if (contactRows.error) throw contactRows.error;
        if (leadRows.error) throw leadRows.error;

        let workflowProjectIds = projectId ? [projectId] : [];
        if (!projectId && businessId) {
          const { data: projects, error } = await supabase
            .from("projects")
            .select("id")
            .eq("business_id", businessId);
          if (error) throw error;
          workflowProjectIds = (projects || []).map((project: { id: string }) => project.id);
        }

        const contactIds = (contactRows.data || []).map((contact: { id: string }) => contact.id);
        const leadIds = (leadRows.data || []).map((lead: { id: string }) => lead.id);
        const dealScopeFilters = [
          ...(contactIds.length ? [`contact_id.in.(${contactIds.join(",")})`] : []),
          ...(leadIds.length ? [`lead_id.in.(${leadIds.join(",")})`] : []),
        ];
        const dealsQuery = supabase.from("crm_deals").select("id", { count: "exact", head: true });
        const dealsPromise = dealScopeFilters.length
          ? dealsQuery.or(dealScopeFilters.join(","))
          : Promise.resolve({ count: 0 });
        const workflowsPromise = workflowProjectIds.length
          ? supabase.from("crm_workflows").select("id", { count: "exact", head: true }).in("project_id", workflowProjectIds)
          : Promise.resolve({ count: 0 });

        const [contactsRes, leadsRes, dealsRes, workflowsRes, submissionsRes] = await Promise.all([
          contactsQuery,
          leadsQuery,
          dealsPromise,
          workflowsPromise,
          submissionsQuery,
        ]);

        setStats({
          contacts: contactsRes.count || 0,
          leads: leadsRes.data?.length || 0,
          deals: dealsRes.count || 0,
          workflows: workflowsRes.count || 0,
          submissions: submissionsRes.data?.length || 0,
          recentLeads: leadsRes.data || [],
          recentSubmissions: submissionsRes.data || [],
        });
      } catch (error) {
        console.error("Error fetching CRM stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [businessId, projectId]);

  const statCards = [
    { title: "Total Contacts", value: stats.contacts, icon: Users, color: "text-blue-500", view: "contacts" as const },
    { title: "Active Leads", value: stats.leads, icon: Target, color: "text-green-500", view: "leads" as const },
    { title: "Pipeline Deals", value: stats.deals, icon: Kanban, color: "text-indigo-500", view: "pipeline" as const },
    { title: "Workflows", value: stats.workflows, icon: Workflow, color: "text-purple-500", view: "workflows" as const },
    { title: "Form Submissions", value: stats.submissions, icon: FileText, color: "text-orange-500", view: "forms" as const },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <Card 
            key={stat.title} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigate(stat.view)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Recent Leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentLeads.length === 0 ? (
              <p className="text-muted-foreground text-sm">No leads yet</p>
            ) : (
              <div className="space-y-3">
                {stats.recentLeads.map((lead: any) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{lead.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {lead.value ? `$${lead.value}` : "No value set"}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        lead.status === "new"
                          ? "bg-blue-100 text-blue-700"
                          : lead.status === "qualified"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {lead.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Form Submissions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5 text-orange-500" />
              Recent Form Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentSubmissions.length === 0 ? (
              <p className="text-muted-foreground text-sm">No submissions yet</p>
            ) : (
              <div className="space-y-3">
                {stats.recentSubmissions.map((submission: any) => (
                  <div
                    key={submission.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{submission.form_name || submission.form_id}</p>
                      <p className="text-sm text-muted-foreground">
                        {submission.data?.email || "No email"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(submission.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Real-time outcomes from generated sites (Milestone 5) */}
      {businessId && <CRMActivityFeed businessId={businessId} />}

      {/* Live GHL workflow activity */}
      <WorkflowActivityFeed projectId={projectId} />

      {/* Event-to-action rules */}
      <GhlReactionsManager businessId={businessId} />
    </div>
  );
}

