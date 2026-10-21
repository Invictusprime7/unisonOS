import { useEffect, useState } from "react";
import { applyResourceOp, queryResource } from "@/services/resources/resourceRuntime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Search, Plus, Zap, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

// Map CRM automation trigger_event values to Inngest event names
const TRIGGER_TO_INNGEST: Record<string, string> = {
  contact_created: 'crm/contact.created',
  lead_created: 'crm/lead.created',
  lead_status_changed: 'crm/lead.status.changed',
  deal_created: 'crm/deal.created',
  deal_stage_changed: 'crm/deal.stage.changed',
  form_submitted: 'form/submitted',
};

interface Automation {
  id: string;
  name: string;
  trigger_event: string;
  conditions: any[];
  actions: any[];
  is_active: boolean;
  created_at: string;
}

const triggerEvents = [
  { value: "contact_created", label: "Contact Created" },
  { value: "lead_created", label: "Lead Created" },
  { value: "lead_status_changed", label: "Lead Status Changed" },
  { value: "deal_created", label: "Deal Created" },
  { value: "deal_stage_changed", label: "Deal Stage Changed" },
  { value: "form_submitted", label: "Form Submitted" },
];

// Action types available for future action configuration UI
const actionTypes = [
  { value: "send_email", label: "Send Email" },
  { value: "create_task", label: "Create Task" },
  { value: "update_field", label: "Update Field" },
  { value: "add_tag", label: "Add Tag" },
  { value: "trigger_webhook", label: "Trigger Webhook" },
];

interface CRMAutomationsProps {
  businessId: string;
  projectId: string;
}

export function CRMAutomations({ businessId, projectId }: CRMAutomationsProps) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    trigger_event: "contact_created",
  });

  useEffect(() => {
    fetchAutomations();
  }, [businessId, projectId]);

  async function fetchAutomations() {
    try {
      const records = await queryResource("crm:automations", {
        businessId,
        projectId,
        mode: "cloud",
      });
      setAutomations(records as unknown as Automation[]);
    } catch (error) {
      console.error("Error fetching automations:", error);
      toast.error("Failed to load automations");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const inngestEvent = TRIGGER_TO_INNGEST[formData.trigger_event] || formData.trigger_event;

      const automationData = {
        name: formData.name,
        trigger_event: formData.trigger_event,
        conditions: [],
        actions: [{ type: 'inngest_dispatch', config: { event: inngestEvent } }],
      };

      if (editingAutomation) {
        await applyResourceOp({
          op: "update",
          ref: { resourceKey: "crm:automations", kind: "crm", recordId: editingAutomation.id },
          values: automationData,
        }, { businessId, projectId, mode: "cloud" });
        toast.success("Automation updated");
      } else {
        await applyResourceOp({ op: "create", resourceKey: "crm:automations", values: automationData }, {
          businessId,
          projectId,
          mode: "cloud",
        });
        toast.success("Automation created");
      }

      setDialogOpen(false);
      setEditingAutomation(null);
      setFormData({ name: "", trigger_event: "contact_created" });
      fetchAutomations();
    } catch (error) {
      console.error("Error saving automation:", error);
      toast.error("Failed to save automation");
    }
  }

  async function toggleAutomation(id: string, isActive: boolean) {
    try {
      await applyResourceOp({
        op: "update",
        ref: { resourceKey: "crm:automations", kind: "crm", recordId: id },
        values: { is_active: isActive },
      }, { businessId, projectId, mode: "cloud" });
      toast.success(isActive ? "Automation activated" : "Automation deactivated");
      fetchAutomations();
    } catch (error) {
      console.error("Error toggling automation:", error);
      toast.error("Failed to update automation");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this automation?")) return;

    try {
      await applyResourceOp({
        op: "delete",
        ref: { resourceKey: "crm:automations", kind: "crm", recordId: id },
      }, { businessId, projectId, mode: "cloud" });
      toast.success("Automation deleted");
      fetchAutomations();
    } catch (error) {
      console.error("Error deleting automation:", error);
      toast.error("Failed to delete automation");
    }
  }

  function openEditDialog(automation: Automation) {
    setEditingAutomation(automation);
    setFormData({
      name: automation.name,
      trigger_event: automation.trigger_event,
    });
    setDialogOpen(true);
  }

  const filteredAutomations = automations.filter((a) =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            placeholder="Search automations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingAutomation(null);
                setFormData({ name: "", trigger_event: "contact_created" });
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Automation
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAutomation ? "Edit Automation" : "Create Automation"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Automation name"
                />
              </div>
              <div className="space-y-2">
                <Label>Trigger Event</Label>
                <Select
                  value={formData.trigger_event}
                  onValueChange={(v) => setFormData({ ...formData, trigger_event: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerEvents.map((event) => (
                      <SelectItem key={event.value} value={event.value}>
                        {event.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Advanced conditions and actions can be configured after creation through the
                  automation editor.
                </p>
              </div>
              <Button type="submit" className="w-full">
                {editingAutomation ? "Update Automation" : "Create Automation"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Automations Grid */}
      {filteredAutomations.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">No automations found</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAutomations.map((automation) => (
            <Card key={automation.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    <CardTitle className="text-base">{automation.name}</CardTitle>
                  </div>
                  <Switch
                    checked={automation.is_active}
                    onCheckedChange={(checked) => toggleAutomation(automation.id, checked)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {triggerEvents.find((e) => e.value === automation.trigger_event)?.label ||
                      automation.trigger_event}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {automation.conditions?.length > 0 && (
                    <div>{automation.conditions.length} condition(s)</div>
                  )}
                  {automation.actions?.length > 0 && (
                    <div>{automation.actions.length} action(s)</div>
                  )}
                  {(!automation.conditions || automation.conditions.length === 0) &&
                    (!automation.actions || automation.actions.length === 0) && (
                      <div className="text-xs">No conditions or actions configured</div>
                    )}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button size="sm" variant="ghost" onClick={() => openEditDialog(automation)}>
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(automation.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
