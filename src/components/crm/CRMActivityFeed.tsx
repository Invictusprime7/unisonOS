/**
 * CRMActivityFeed — Milestone 5.
 *
 * Live feed of recent CRM activity (leads, bookings, quotes, contact
 * submissions) plus outstanding follow-up tasks. Reads from
 * `crm_activities` and `tasks` scoped by business_id.
 */

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Activity, CheckCircle2, ClipboardList, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  businessId: string | null | undefined;
  className?: string;
}

interface ActivityRow {
  id: string;
  type: string;
  title: string | null;
  description: string | null;
  created_at: string;
}

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  due_date: string | null;
}

const ACTIVITY_LABEL: Record<string, string> = {
  lead_captured: 'New lead',
  quote_requested: 'Quote requested',
  booking: 'Booking',
  contact_submitted: 'Contact form',
};

export function CRMActivityFeed({ businessId, className }: Props) {
  const [activities, setActivities] = React.useState<ActivityRow[]>([]);
  const [tasks, setTasks] = React.useState<TaskRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    if (!businessId) {
      setActivities([]);
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: acts }, { data: tks }] = await Promise.all([
      supabase
        .from('crm_activities')
        .select('id,type,title,description,created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(15),
      supabase
        .from('tasks')
        .select('id,title,description,status,priority,due_date')
        .eq('business_id', businessId)
        .neq('status', 'done')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10),
    ]);
    setActivities((acts as ActivityRow[]) ?? []);
    setTasks((tks as TaskRow[]) ?? []);
    setLoading(false);
  }, [businessId]);

  React.useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('unison:outcome-recorded', handler);
    return () => window.removeEventListener('unison:outcome-recorded', handler);
  }, [refresh]);

  const markDone = React.useCallback(
    async (id: string) => {
      await supabase.from('tasks').update({ status: 'done' }).eq('id', id);
      refresh();
    },
    [refresh],
  );

  return (
    <div className={cn('grid gap-4 md:grid-cols-2', className)}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" /> Recent activity
          </CardTitle>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <Sparkles className="mx-auto mb-2 h-5 w-5 opacity-60" />
              No activity yet. Real leads, bookings, and quote requests will land here.
            </div>
          ) : (
            <ul className="space-y-3">
              {activities.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {ACTIVITY_LABEL[a.type] ?? a.type}
                      {a.title ? ` · ${a.title}` : ''}
                    </p>
                    {a.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{a.description}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Follow-ups due
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              You are all caught up.
            </div>
          ) : (
            <ul className="space-y-3">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-3 rounded-md border p-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{t.title}</p>
                    {t.description && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.description}</p>
                    )}
                    {t.due_date && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Due {formatDistanceToNow(new Date(t.due_date), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => markDone(t.id)}>
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CRMActivityFeed;
