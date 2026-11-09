/**
 * BusinessProfileGate — Milestone 1 signup→launch bridge.
 *
 * Ensures a signed-in owner has a minimum Business Profile
 * (name + industry + notification email) before the prompt-first launch opens.
 * Uses `scoreProfileCompleteness` for the same rules the publish gate uses,
 * so preview↔publish stay consistent.
 *
 * Additive: only rendered by opt-in callers (Onboarding). No side effects
 * on returning users whose profile is already complete — the gate resolves
 * to `ready` immediately and calls `onReady()`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, ArrowRight, Building2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import {
  loadBusinessProfile,
  saveBusinessProfile,
} from '@/services/businessProfileService';
import { scoreProfileCompleteness, type BusinessProfileDTO } from '@/types/businessProfile';

const INDUSTRIES = [
  { value: 'local-service', label: 'Local Service (cleaning, contractor, mobile)' },
  { value: 'salon', label: 'Salon / Barber / Spa' },
  { value: 'coaching', label: 'Coaching / Consulting' },
  { value: 'restaurant', label: 'Restaurant / Cafe' },
  { value: 'ecommerce', label: 'E-commerce / Retail' },
  { value: 'agency', label: 'Agency / B2B' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'fitness', label: 'Fitness / Studio' },
  { value: 'real-estate', label: 'Real Estate' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the resolved businessId once the profile is complete. */
  onReady: (businessId: string, profile: BusinessProfileDTO) => void;
}

export function BusinessProfileGate({ open, onOpenChange, onReady }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState<string>('local-service');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Load or provision the user's owned business.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) {
          setError('You must be signed in.');
          return;
        }
        // Find owned business.
        const { data: rows } = await supabase
          .from('businesses')
          .select('id, name, industry, notification_email, email, phone, owner_id')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1);
        let row = rows?.[0];
        if (!row) {
          // Provision minimal owned business row.
          const { data: created, error: createErr } = await supabase
            .from('businesses')
            .insert({
              owner_id: user.id,
              name: user.user_metadata?.full_name
                ? `${user.user_metadata.full_name}'s Business`
                : 'My Business',
            })
            .select('id, name, industry, notification_email, email, phone, owner_id')
            .single();
          if (createErr) throw createErr;
          row = created;
        }
        if (cancelled || !row) return;
        setBusinessId(row.id);
        setName(row.name ?? '');
        setIndustry((row.industry as string) || 'local-service');
        setNotificationEmail(
          (row.notification_email as string) || (row.email as string) || user.email || '',
        );
        setPhone((row.phone as string) || '');
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Auto-resolve if profile already complete.
  useEffect(() => {
    if (!open || loading || !businessId) return;
    (async () => {
      const profile = await loadBusinessProfile(businessId);
      if (!profile) return;
      const report = scoreProfileCompleteness(profile);
      const blockers = report.missingRequired.filter((f) => f.blocksPublish);
      // Only auto-advance when the *root* identity fields are complete.
      const rootReady = !!profile.name && !!profile.industry && !!profile.notificationEmail;
      if (rootReady && blockers.length <= 2) {
        onReady(businessId, profile);
        onOpenChange(false);
      }
    })();
  }, [open, loading, businessId, onReady, onOpenChange]);

  const canSubmit = useMemo(
    () => !!name.trim() && !!industry && /.+@.+\..+/.test(notificationEmail),
    [name, industry, notificationEmail],
  );

  const submit = useCallback(async () => {
    if (!businessId || !canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const patched = await saveBusinessProfile(businessId, {
        name: name.trim(),
        industry,
        notificationEmail: notificationEmail.trim(),
        email: notificationEmail.trim(),
        phone: phone.trim() || null,
      });
      if (patched) {
        onReady(businessId, patched);
        onOpenChange(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [businessId, canSubmit, name, industry, notificationEmail, phone, onReady, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-cyan-500" />
            Set up your business
          </DialogTitle>
          <DialogDescription>
            The rest of Unison — your site, CRM, booking, and notifications — will
            all connect to this profile.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-cyan-500" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="bp-name">Business name</Label>
              <Input
                id="bp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sparkle Cleaning Co."
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="bp-industry">Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger id="bp-industry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="bp-email">Notification email</Label>
              <Input
                id="bp-email"
                type="email"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                placeholder="you@business.com"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Where leads and bookings will be delivered.
              </p>
            </div>
            <div>
              <Label htmlFor="bp-phone">Business phone (optional)</Label>
              <Input
                id="bp-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 555-5555"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              className="w-full"
              disabled={!canSubmit || saving}
              onClick={submit}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="h-4 w-4 ml-2 order-2" />
              )}
              Continue to launcher
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
