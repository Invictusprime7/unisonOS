import { useCallback, useEffect, useState } from 'react';
import { Copy, Loader2, Plus, RotateCw, Webhook } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase as rawSupabase } from '@/integrations/supabase/client';

const supabase: any = rawSupabase;

interface ProjectGhlIntegration {
  id: string;
  display_name: string;
  external_location_id: string;
  status: 'active' | 'paused';
  updated_at: string;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function generateWebhookSecret(): Promise<{ secret: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const secret = toHex(bytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return { secret, hash: toHex(new Uint8Array(digest)) };
}

export function ProjectGhlIntegration({ projectId, businessId }: { projectId: string; businessId: string }) {
  const [integrations, setIntegrations] = useState<ProjectGhlIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);
  const webhookUrl = `${supabase.supabaseUrl}/functions/v1/ghl-webhook`;

  const loadIntegrations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_integrations')
        .select('id, display_name, external_location_id, status, updated_at')
        .eq('project_id', projectId)
        .eq('business_id', businessId)
        .eq('provider', 'gohighlevel')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setIntegrations((data ?? []) as ProjectGhlIntegration[]);
    } catch (error) {
      console.error('[ProjectGhlIntegration] Failed to load connection metadata', error);
      toast.error('Could not load project integrations');
    } finally {
      setLoading(false);
    }
  }, [businessId, projectId]);

  useEffect(() => { void loadIntegrations(); }, [loadIntegrations]);

  const resetForm = () => {
    setDisplayName('');
    setLocationId('');
    setApiKey('');
  };

  const saveIntegration = async () => {
    const name = displayName.trim();
    const location = locationId.trim();
    if (!name || !location || apiKey.trim().length < 16) {
      toast.error('Enter a connection name, GHL location ID, and private integration token.');
      return;
    }

    setSaving(true);
    try {
      const { secret, hash } = await generateWebhookSecret();
      const { data, error } = await supabase.rpc('save_project_gohighlevel_integration', {
        p_project_id: projectId,
        p_display_name: name,
        p_location_id: location,
        p_api_key: apiKey.trim(),
        p_webhook_secret_hash: hash,
      });
      if (error) throw error;

      setOneTimeSecret(secret);
      setDialogOpen(false);
      resetForm();
      await loadIntegrations();
      toast.success(data?.[0]?.integration_id ? 'Project integration saved' : 'Project integration updated');
    } catch (error) {
      toast.error('Could not save GoHighLevel integration', {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookSecret = async () => {
    if (!oneTimeSecret) return;
    await navigator.clipboard.writeText(oneTimeSecret);
    toast.success('Webhook secret copied. Store it in GoHighLevel now; Unison will not show it again.');
  };

  const copyWebhookUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    toast.success('Project integration webhook URL copied.');
  };

  return (
    <Card className="border-white/5 bg-white/[0.02]">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Webhook className="h-4 w-4 text-cyan-400" /> GoHighLevel connections
          </CardTitle>
          <CardDescription className="mt-1">
            Credentials and webhook routing belong to this project. API tokens are stored in Vault.
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" className="shrink-0 border-white/10" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Connect location
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {oneTimeSecret && (
          <div className="space-y-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-amber-100">Webhook URL</p>
                <code className="block truncate text-xs text-white/60">{webhookUrl}</code>
              </div>
              <Button size="sm" variant="outline" className="shrink-0 border-amber-400/20" onClick={copyWebhookUrl}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy URL
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-amber-100">Copy this webhook secret into GHL now</p>
              <Button size="sm" variant="outline" className="shrink-0 border-amber-400/20" onClick={copyWebhookSecret}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <code className="block select-all break-all rounded bg-black/20 p-2 text-xs text-white/80">{oneTimeSecret}</code>
            <p className="text-xs text-white/45">Set this as the <code>x-webhook-secret</code> header and include the real GoHighLevel <code>locationId</code> in the JSON body. Unison maps that location to this project; no project ID belongs in the URL.</p>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-white/50" onClick={() => setOneTimeSecret(null)}>Dismiss</Button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-white/45"><Loader2 className="h-4 w-4 animate-spin" /> Loading project connections</div>
        ) : integrations.length === 0 ? (
          <p className="py-4 text-sm text-white/40">No GoHighLevel location is connected to this project.</p>
        ) : integrations.map((integration) => (
          <div key={integration.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white/85">{integration.display_name}</p>
              <p className="text-xs text-white/40">GoHighLevel location · updated {new Date(integration.updated_at).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={integration.status === 'active' ? 'border-emerald-500/30 text-emerald-300' : 'border-white/10 text-white/45'}>
                {integration.status === 'active' ? 'Connected' : 'Paused'}
              </Badge>
              <Button size="sm" variant="ghost" className="text-white/60" onClick={() => {
                setDisplayName(integration.display_name);
                setLocationId(integration.external_location_id);
                setApiKey('');
                setDialogOpen(true);
              }}>
                <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Rotate credentials
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!saving) setDialogOpen(open); }}>
        <DialogContent className="border-white/10 bg-[#0d0d18] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect a GoHighLevel location</DialogTitle>
            <DialogDescription>The private integration token is encrypted in Vault. A new webhook secret is generated and shown once.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ghl-display-name">Connection name</Label>
              <Input id="ghl-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Main clinic location" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ghl-location-id">GoHighLevel location ID</Label>
              <Input id="ghl-location-id" value={locationId} onChange={(event) => setLocationId(event.target.value)} placeholder="Paste the location ID from GHL" autoComplete="off" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ghl-api-token">Private integration token</Label>
              <Input id="ghl-api-token" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste the GHL private integration token" autoComplete="new-password" />
              <p className="text-xs text-white/40">To rotate webhook verification only, the current form still requires the private token again.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveIntegration} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? 'Saving securely…' : 'Save connection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}