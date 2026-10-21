import { useEffect, useState } from "react";
import { applyResourceOp, queryResource } from "@/services/resources/resourceRuntime";
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
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, Plus, Mail, Phone, Building, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company: string | null;
  tags: string[];
  source: string | null;
  created_at: string;
}

interface CRMContactsProps {
  businessId?: string;
  projectId?: string;
}

export function CRMContacts({ businessId, projectId }: CRMContactsProps = {}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    company: "",
    tags: "",
  });

  useEffect(() => {
    fetchContacts();
  }, [businessId, projectId]);

  async function fetchContacts() {
    try {
      if (!projectId && !businessId) {
        setContacts([]);
        return;
      }

      const records = await queryResource("crm:contacts", {
        businessId: businessId || "",
        projectId,
        mode: "cloud",
      });
      setContacts(records as unknown as Contact[]);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      const contactData = {
        email: formData.email || null,
        first_name: formData.first_name || null,
        last_name: formData.last_name || null,
        phone: formData.phone || null,
        company: formData.company || null,
        tags: formData.tags ? formData.tags.split(",").map((t) => t.trim()) : [],
      };

      if (editingContact) {
        await applyResourceOp({
          op: "update",
          ref: { resourceKey: "crm:contacts", kind: "crm", recordId: editingContact.id },
          values: contactData,
        }, { businessId: businessId || "", projectId, mode: "cloud" });
        toast.success("Contact updated");
      } else {
        await applyResourceOp({ op: "create", resourceKey: "crm:contacts", values: contactData }, {
          businessId: businessId || "",
          projectId,
          mode: "cloud",
        });
        toast.success("Contact created");
      }

      setDialogOpen(false);
      setEditingContact(null);
      setFormData({ email: "", first_name: "", last_name: "", phone: "", company: "", tags: "" });
      fetchContacts();
    } catch (error) {
      console.error("Error saving contact:", error);
      toast.error("Failed to save contact");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this contact?")) return;

    try {
      await applyResourceOp({
        op: "delete",
        ref: { resourceKey: "crm:contacts", kind: "crm", recordId: id },
      }, { businessId: businessId || "", projectId, mode: "cloud" });
      toast.success("Contact deleted");
      fetchContacts();
    } catch (error) {
      console.error("Error deleting contact:", error);
      toast.error("Failed to delete contact");
    }
  }

  function openEditDialog(contact: Contact) {
    setEditingContact(contact);
    setFormData({
      email: contact.email || "",
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      phone: contact.phone || "",
      company: contact.company || "",
      tags: contact.tags?.join(", ") || "",
    });
    setDialogOpen(true);
  }

  const filteredContacts = contacts.filter(
    (c) =>
      c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.company?.toLowerCase().includes(searchTerm.toLowerCase())
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
            placeholder="Search contacts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              setEditingContact(null);
              setFormData({ email: "", first_name: "", last_name: "", phone: "", company: "", tags: "" });
            }}>
              <Plus className="h-4 w-4 mr-1" /> Add Contact
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingContact ? "Edit Contact" : "Add Contact"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="lead, newsletter, vip"
                />
              </div>
              <Button type="submit" className="w-full">
                {editingContact ? "Update Contact" : "Create Contact"}
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
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No contacts found
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setSelectedContact(contact)}
                        aria-label={`View ${contact.first_name || contact.last_name || contact.email || 'contact'}`}
                      >
                        {contact.first_name || contact.last_name
                          ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
                          : "—"}
                      </button>
                    </TableCell>
                    <TableCell>
                      {contact.email ? (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {contact.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {contact.company ? (
                        <span className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          {contact.company}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {contact.tags?.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {contact.source || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(contact)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(contact.id)}
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

      <Sheet open={Boolean(selectedContact)} onOpenChange={(open) => { if (!open) setSelectedContact(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selectedContact && (
            <div className="space-y-6">
              <SheetHeader>
                <SheetTitle>
                  {[selectedContact.first_name, selectedContact.last_name].filter(Boolean).join(' ') || 'Contact'}
                </SheetTitle>
                <SheetDescription>Contact record</SheetDescription>
              </SheetHeader>

              <dl className="grid gap-4">
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Email</dt>
                  <dd className="break-all text-sm">{selectedContact.email || '—'}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Phone</dt>
                  <dd className="text-sm">{selectedContact.phone || '—'}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Company</dt>
                  <dd className="text-sm">{selectedContact.company || '—'}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Source</dt>
                  <dd className="text-sm">{selectedContact.source || '—'}</dd>
                </div>
                <div className="space-y-2">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Tags</dt>
                  <dd className="flex flex-wrap gap-1">
                    {selectedContact.tags?.length
                      ? selectedContact.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)
                      : <span className="text-sm">—</span>}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-medium uppercase text-muted-foreground">Created</dt>
                  <dd className="text-sm">{selectedContact.created_at ? new Date(selectedContact.created_at).toLocaleString() : '—'}</dd>
                </div>
              </dl>

              <Button onClick={() => {
                const contact = selectedContact;
                setSelectedContact(null);
                openEditDialog(contact);
              }}>
                <Edit className="mr-2 h-4 w-4" />Edit contact
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
