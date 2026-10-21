import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Search, Plus, DollarSign, Calendar } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCRMActions } from "@/hooks/useCRMActions";
import { queryResource } from '@/services/resources/resourceRuntime';

interface Deal {
  id: string;
  title: string;
  stage: string;
  value: number | null;
  expected_close_date: string | null;
  contact_id: string | null;
  lead_id: string | null;
  created_at: string;
}

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Lead {
  id: string;
  title: string;
}

const stages = [
  { id: "prospecting", label: "Prospecting", color: "bg-blue-100 border-blue-300" },
  { id: "negotiation", label: "Negotiation", color: "bg-yellow-100 border-yellow-300" },
  { id: "closed_won", label: "Closed Won", color: "bg-green-100 border-green-300" },
  { id: "closed_lost", label: "Closed Lost", color: "bg-red-100 border-red-300" },
];

export function CRMPipeline({ businessId, projectId }: { businessId?: string; projectId?: string } = {}) {
  const crm = useCRMActions({ businessId, projectId });
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [draggedDeal, setDraggedDeal] = useState<Deal | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    value: "",
    expected_close_date: "",
    contact_id: "",
    lead_id: "",
    stage: "prospecting",
  });

  useEffect(() => {
    fetchDeals();
    fetchContacts();
    fetchLeads();
  }, [businessId, projectId]);

  async function fetchDeals() {
    try {
      const records = await queryResource('crm:deals', {
        businessId: businessId || activeBizId || '',
        projectId,
        mode: 'cloud',
      });
      setDeals(records as unknown as Deal[]);
    } catch (error) {
      console.error("Error fetching deals:", error);
      toast.error("Failed to load deals");
    } finally {
      setLoading(false);
    }
  }

  async function fetchContacts() {
    try {
      const records = await queryResource('crm:contacts', {
        businessId: businessId || activeBizId || '',
        projectId,
        mode: 'cloud',
      });
      setContacts(records as unknown as Contact[]);
    } catch (error) {
      console.error("Error fetching contacts:", error);
    }
  }

  async function fetchLeads() {
    try {
      const records = await queryResource('crm:leads', {
        businessId: businessId || activeBizId || '',
        projectId,
        mode: 'cloud',
      });
      setLeads(records as unknown as Lead[]);
    } catch (error) {
      console.error("Error fetching leads:", error);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const dealData = {
        title: formData.title,
        stage: formData.stage,
        value: formData.value ? parseFloat(formData.value) : null,
        expected_close_date: formData.expected_close_date || null,
        contact_id: formData.contact_id || null,
        lead_id: formData.lead_id || null,
      };

      // Use hook: inserts deal AND fires crm/deal.created event
      const result = await crm.createDeal(dealData);
      if (!result.success) throw new Error(result.error);

      toast.success("Deal created");
      setDialogOpen(false);
      setFormData({
        title: "",
        value: "",
        expected_close_date: "",
        contact_id: "",
        lead_id: "",
        stage: "prospecting",
      });
      fetchDeals();
    } catch (error) {
      console.error("Error creating deal:", error);
      toast.error("Failed to create deal");
    }
  }

  async function updateDealStage(dealId: string, newStage: string, oldStage: string): Promise<boolean> {
    try {
      // Use hook: updates stage AND fires crm/deal.stage.changed + orchestrator dispatch
      const result = await crm.moveDealStage(dealId, oldStage, newStage);
      if (!result.success) throw new Error(result.error);

      toast.success(`Deal moved to ${stages.find(s => s.id === newStage)?.label}`);
      fetchDeals();
      return true;
    } catch (error) {
      console.error("Error updating deal stage:", error);
      toast.error("Failed to update deal stage");
      return false;
    }
  }

  function handleDragStart(deal: Deal) {
    setDraggedDeal(deal);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent, newStage: string) {
    e.preventDefault();
    if (draggedDeal && draggedDeal.stage !== newStage) {
      updateDealStage(draggedDeal.id, newStage, draggedDeal.stage);
    }
    setDraggedDeal(null);
  }

  const filteredDeals = deals.filter((deal) =>
    deal.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDealsByStage = (stageId: string) =>
    filteredDeals.filter((deal) => deal.stage === stageId);

  const getTotalValue = (stageId: string) =>
    getDealsByStage(stageId).reduce((sum, deal) => sum + (deal.value || 0), 0);

  const selectedContact = selectedDeal
    ? contacts.find((contact) => contact.id === selectedDeal.contact_id)
    : undefined;
  const selectedLead = selectedDeal
    ? leads.find((lead) => lead.id === selectedDeal.lead_id)
    : undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search deals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-1" /> Add Deal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Deal</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Deal title"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Value ($)</Label>
                  <Input
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expected Close Date</Label>
                  <Input
                    type="date"
                    value={formData.expected_close_date}
                    onChange={(e) =>
                      setFormData({ ...formData, expected_close_date: e.target.value })
                    }
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">
                Create Deal
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pipeline Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stages.map((stage) => {
          const stageDeals = getDealsByStage(stage.id);
          const totalValue = getTotalValue(stage.id);

          return (
            <div
              key={stage.id}
              className={cn("rounded-lg border-2 p-4", stage.color)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              <div className="mb-3">
                <h3 className="font-semibold text-sm mb-1">{stage.label}</h3>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{stageDeals.length} deals</span>
                  <span className="flex items-center gap-0.5">
                    <DollarSign className="h-3 w-3" />
                    {totalValue.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {stageDeals.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No deals
                  </div>
                ) : (
                  stageDeals.map((deal) => (
                    <Card
                      key={deal.id}
                      draggable
                      onDragStart={() => handleDragStart(deal)}
                      className="cursor-move hover:shadow-md transition-shadow"
                    >
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm font-medium line-clamp-2">
                          <button
                            type="button"
                            className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => setSelectedDeal(deal)}
                          >
                            {deal.title}
                          </button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-0 space-y-1">
                        {deal.value && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <DollarSign className="h-3 w-3" />
                            <span className="font-medium">
                              {deal.value.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {deal.expected_close_date && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(deal.expected_close_date).toLocaleDateString()}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Sheet open={Boolean(selectedDeal)} onOpenChange={(open) => { if (!open) setSelectedDeal(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selectedDeal && (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle>{selectedDeal.title}</SheetTitle>
                <SheetDescription>Sales opportunity</SheetDescription>
              </SheetHeader>

              <dl className="grid gap-4">
                <div className="space-y-2">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Stage</dt>
                  <dd>
                    <Select value={selectedDeal.stage} onValueChange={(nextStage) => {
                      const deal = selectedDeal;
                      void updateDealStage(deal.id, nextStage, deal.stage).then((updated) => {
                        if (updated) setSelectedDeal((current) => current?.id === deal.id ? { ...current, stage: nextStage } : current);
                      });
                    }}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{stages.map((stage) => <SelectItem key={stage.id} value={stage.id}>{stage.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Value</dt>
                  <dd className="text-sm">{selectedDeal.value == null ? '—' : `$${selectedDeal.value.toLocaleString()}`}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Expected close</dt>
                  <dd className="text-sm">{selectedDeal.expected_close_date ? new Date(selectedDeal.expected_close_date).toLocaleDateString() : '—'}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Contact</dt>
                  <dd className="text-sm">{selectedContact?.email || [selectedContact?.first_name, selectedContact?.last_name].filter(Boolean).join(' ') || '—'}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Lead</dt>
                  <dd className="text-sm">{selectedLead?.title || '—'}</dd>
                </div>
              </dl>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Deals</p>
          <p className="text-2xl font-bold">{filteredDeals.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Pipeline Value</p>
          <p className="text-2xl font-bold">
            ${filteredDeals.reduce((sum, deal) => sum + (deal.value || 0), 0).toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Won Deals</p>
          <p className="text-2xl font-bold text-green-600">
            {getDealsByStage("closed_won").length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Win Rate</p>
          <p className="text-2xl font-bold">
            {filteredDeals.length > 0
              ? Math.round((getDealsByStage("closed_won").length / filteredDeals.length) * 100)
              : 0}
            %
          </p>
        </Card>
      </div>
    </div>
  );
}
