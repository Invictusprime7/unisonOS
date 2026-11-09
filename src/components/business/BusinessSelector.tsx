/**
 * BusinessSelector — dark-themed dropdown for choosing a Business Profile.
 *
 * Mounted in:
 *   - Wizard (prompt-first launch step 1)                → mode="member"
 *   - Web Builder topbar pill (BusinessPill)        → mode="admin"
 *   - Cloud Settings "Projects & businesses" table  → mode="admin"
 *
 * `mode="admin"` filters to businesses where the current user is owner
 * or admin (required for reassignment). `mode="member"` shows every
 * membership. `allowCreate` adds an inline "+ New business" affordance.
 */

import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, ChevronDown, Loader2, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  loadBusinessMemberships,
  isAdminRole,
  type BusinessMembershipRow,
} from '@/services/businessMembership';
import { CreateBusinessInline } from './CreateBusinessInline';

export interface BusinessSelectorProps {
  value: string | null | undefined;
  onChange: (businessId: string, row: BusinessMembershipRow) => void;
  mode?: 'admin' | 'member';
  allowCreate?: boolean;
  size?: 'sm' | 'md';
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function BusinessSelector({
  value,
  onChange,
  mode = 'member',
  allowCreate = false,
  size = 'md',
  placeholder = 'Select a business',
  disabled,
  className,
}: BusinessSelectorProps) {
  const [userId, setUserId] = useState<string>('');
  const [rows, setRows] = useState<BusinessMembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? '';
      if (cancelled) return;
      setUserId(uid);
      if (!uid) {
        setRows([]);
        setLoading(false);
        return;
      }
      try {
        const memberships = await loadBusinessMemberships(uid);
        if (!cancelled) setRows(memberships);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => (mode === 'admin' ? rows.filter((r) => isAdminRole(r.role)) : rows),
    [rows, mode],
  );

  const selected = filtered.find((r) => r.businessId === value) ?? rows.find((r) => r.businessId === value);
  const label = selected?.name ?? placeholder;

  const handleCreated = (id: string, name: string) => {
    const row: BusinessMembershipRow = { businessId: id, name, industry: null, role: 'owner' };
    setRows((prev) => [row, ...prev]);
    setCreating(false);
    setOpen(false);
    onChange(id, row);
  };

  const btnSizeCls = size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-2.5 text-sm';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'gap-1.5 bg-[#0d0d18] border-cyan-500/20 text-cyan-100 hover:bg-cyan-500/10 hover:text-cyan-50 hover:border-cyan-500/40',
            btnSizeCls,
            className,
          )}
        >
          <Building2 className="h-3.5 w-3.5 opacity-70" />
          <span className="truncate max-w-[180px]">{label}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-72 p-0 bg-[#0a0a12] border-cyan-500/20 text-cyan-100"
      >
        {creating ? (
          <CreateBusinessInline
            userId={userId}
            onCancel={() => setCreating(false)}
            onCreated={handleCreated}
          />
        ) : (
          <div className="max-h-72 overflow-y-auto py-1">
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-6 text-xs text-cyan-100/50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading businesses…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-6 text-xs text-cyan-100/50">
                {mode === 'admin'
                  ? 'You are not an admin of any business yet.'
                  : 'You have no business profiles yet.'}
              </div>
            ) : (
              filtered.map((row) => {
                const isSelected = row.businessId === value;
                return (
                  <button
                    key={row.businessId}
                    onClick={() => {
                      onChange(row.businessId, row);
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left',
                      'hover:bg-cyan-500/10',
                      isSelected && 'bg-cyan-500/10 text-cyan-200',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{row.name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-cyan-100/40">
                        {row.role}
                        {row.industry ? ` · ${row.industry}` : ''}
                      </div>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-cyan-400 shrink-0" />}
                  </button>
                );
              })
            )}
            {allowCreate && (
              <button
                onClick={() => setCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-cyan-300 hover:bg-cyan-500/10 border-t border-cyan-500/10"
              >
                <Plus className="h-4 w-4" /> New business profile
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
