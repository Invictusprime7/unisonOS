import { useEffect, useState } from "react";
import { supabase as _sb } from "@/integrations/supabase/client";
const supabase: any = _sb;
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, Plus, DollarSign, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { sendInngestEvent } from "@/services/inngestService";
import { applyResourceOp, queryResource } from "@/services/resources/resourceRuntime";

interface Lead {
  id: string;
  title: string;
  status: string;
  value: number | null;
  source: string | null;
  notes: string | null;
  business_id?: string | null;
  metadata?: any;
  contact_id: string | null;
  created_at: string;
}

type BusinessRow = {
  id: string;
  name: string;
};

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-yellow-100 text-yellow-700",
  qualified: "bg-green-100 text-green-700",
  proposal: "bg-purple-100 text-purple-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-700",
};

interface CRMLeadsProps {
  businessId?: string;
  projectId?: string;
}

export function CRMLeads({ businessId, projectId }: CRMLeadsProps = {}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    status: "new",
    value: "",
    source: "",
    notes: "",
  });

  // Hook for automation event emission
  const activeBizId = businessId || (selectedBusinessId !== "all" ? selectedBusinessId : undefined);

  useEffect(() => {
    if (!businessId && !projectId) {
      loadBusinesses();
    }
  }, [businessId, projectId]);

  useEffect(() => {
    fetchLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBusinessId, projectId]);

  async function loadBusinesses() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

      const { data, error } = await supabase
        .from('businesses' as any)
        .select('id,name')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBusinesses((data || []) as BusinessRow[]);
    } catch (e) {
      console.warn('[CRMLeads] Failed to load businesses', e);
    }
  }

  async function fetchLeads() {
    try {
      if (!projectId && !activeBizId) {
        setLeads([]);
        return;
      }

      const records = await queryResource("crm:leads", {
        businessId: activeBizId || "",
        projectId,
        mode: "cloud",
      });
      setLeads(records as unknown as Lead[]);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      const leadData = {
        title: formData.title,
        status: formData.status,
        value: formData.value ? parseFloat(formData.value) : null,
        source: formData.source || null,
        notes: formData.notes || null,
      };

      if (editingLead) {
        await applyResourceOp({
          op: "update",
          ref: { resourceKey: "crm:leads", kind: "crm", recordId: editingLead.id },
          values: leadData,
        }, { businessId: activeBizId || "", projectId, mode: "cloud" });
        toast.success("Lead updated");
      } else {
        const created = await applyResourceOp({ op: "create", resourceKey: "crm:leads", values: leadData }, {
          businessId: activeBizId || "",
          projectId,
          mode: "cloud",
        });
        toast.success("Lead created");

        // Fire automation: crm/lead.created
        if (activeBizId && created?.id) {
          sendInngestEvent('crm/lead.created', {
            leadId: created.id,
            businessId: activeBizId,
            projectId,
            source: formData.source || 'crm',
          }).catch(console.warn);
        }
      }

      setDialogOpen(false);
      setEditingLead(null);
      setFormData({ title: "", status: "new", value: "", source: "", notes: "" });
      fetchLeads();
    } catch (error) {
      console.error("Error saving lead:", error);
      toast.error("Failed to save lead");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this lead?")) return;

    try {
      await applyResourceOp({
        op: "delete",
        ref: { resourceKey: "crm:leads", kind: "crm", recordId: id },
      }, { businessId: activeBizId || "", projectId, mode: "cloud" });
      toast.success("Lead deleted");
      fetchLeads();
    } catch (error) {
      console.error("Error deleting lead:", error);
      toast.error("Failed to delete lead");
    }
  }

  async function updateStatus(id: string, newStatus: string) {
    try {
      // Find the current lead to get old status
      const lead = leads.find(l => l.id === id);
      const oldStatus = lead?.status || 'unknown';

      await applyResourceOp({
        op: "update",
        ref: { resourceKey: "crm:leads", kind: "crm", recordId: id },
        values: { status: newStatus },
      }, { businessId: activeBizId || "", projectId, mode: "cloud" });
      toast.success("Status updated");

      // Fire automation: crm/lead.status.changed
      if (activeBizId) {
        sendInngestEvent('crm/lead.status.changed', {
          leadId: id,
          businessId: activeBizId,
          projectId,
          previousStatus: oldStatus,
          newStatus,
        }).catch(console.warn);
      }

      fetchLeads();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  }

  function openEditDialog(lead: Lead) {
    setEditingLead(lead);
    setFormData({
      title: lead.title,
      status: lead.status,
      value: lead.value?.toString() || "",
      source: lead.source || "",
      notes: lead.notes || "",
    });
    setDialogOpen(true);
  }

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = lead.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalValue = filteredLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Leads</p>
          <p className="text-2xl font-bold">{filteredLeads.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Pipeline Value</p>
          <p className="text-2xl font-bold">${totalValue.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Won</p>
          <p className="text-2xl font-bold text-green-600">
            {leads.filter((l) => l.status === "won").length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">New</p>
          <p className="text-2xl font-bold text-blue-600">
            {leads.filter((l) => l.status === "new").length}
          </p>
        </Card>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="won">Won</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>

          {!businessId && !projectId && (
            <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Business" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All businesses</SelectItem>
                {businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingLead(null);
              setFormData({ title: "", status: "new", value: "", source: "", notes: "" });
            }}>
              <Plus className="h-4 w-4 mr-1" /> Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingLead ? "Edit Lead" : "Add Lead"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Lead title"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Value ($)</Label>
                  <Input
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Source</Label>
                <Input
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="Website, referral, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
              <Button type="submit" className="w-full">
                {editingLead ? "Update Lead" : "Create Lead"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No leads found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setSelectedLead(lead)}
                        aria-label={`View ${lead.title}`}
                      >
                        {lead.title}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={lead.status}
                        onValueChange={(v) => updateStatus(lead.id, v)}
                      >
                        <SelectTrigger className="w-[120px]">
                          <Badge className={statusColors[lead.status] || "bg-gray-100"}>
                            {lead.status}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="proposal">Proposal</SelectItem>
                          <SelectItem value="won">Won</SelectItem>
                          <SelectItem value="lost">Lost</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {lead.value ? (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {lead.value.toLocaleString()}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.source || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(lead)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(lead.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={Boolean(selectedLead)} onOpenChange={(open) => { if (!open) setSelectedLead(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selectedLead && (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle>{selectedLead.title}</SheetTitle>
                <SheetDescription>Lead record</SheetDescription>
              </SheetHeader>

              <dl className="grid gap-4">
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Status</dt>
                  <dd><Badge className={statusColors[selectedLead.status] || "bg-gray-100"}>{selectedLead.status}</Badge></dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Value</dt>
                  <dd className="text-sm">{selectedLead.value == null ? '—' : `$${selectedLead.value.toLocaleString()}`}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Source</dt>
                  <dd className="text-sm">{selectedLead.source || '—'}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Contact</dt>
                  <dd className="text-sm">{selectedLead.contact_id || '—'}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Notes</dt>
                  <dd className="whitespace-pre-wrap text-sm">{selectedLead.notes || '—'}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Created</dt>
                  <dd className="text-sm">{selectedLead.created_at ? new Date(selectedLead.created_at).toLocaleString() : '—'}</dd>
                </div>
              </dl>

              <Button onClick={() => {
                const lead = selectedLead;
                setSelectedLead(null);
                openEditDialog(lead);
              }}>
                <Edit className="mr-2 h-4 w-4" />Edit lead
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
