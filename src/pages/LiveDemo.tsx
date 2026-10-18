import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Home as HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { HeroSection } from "@/components/home/sections";
import { clearSiteDiscoveryHandoff, writeSiteDiscoveryHandoff } from "@/components/ai/siteDiscoveryPersistence";
import { readAccountDemoStatus, type AccountDemoStatus } from '@/services/accountDemoGeneration';

export default function LiveDemo() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launchBrief, setLaunchBrief] = useState<string | null>(null);
  const [demoStatus, setDemoStatus] = useState<AccountDemoStatus | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [statusRefresh, setStatusRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const refresh = async () => {
      try {
        const status = await readAccountDemoStatus();
        if (active) { setDemoStatus(status); setStatusError(false); }
      } catch { if (active) setStatusError(true); }
    };
    void refresh();
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 15000);
    return () => { active = false; window.removeEventListener('focus', refresh); window.clearInterval(timer); };
  }, [user, statusRefresh, launcherOpen]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
  }, [loading, navigate, user]);

  // First-run only finishes when a project is generated (the launch marks it),
  // so new users keep landing on the demo until then.
  const goHome = () => navigate("/home");

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground" role="status">
        Preparing your live demo...
      </div>
    );
  }

  if (!launcherOpen && (!demoStatus || statusError || demoStatus.inProgress)) {
    return <section className="min-h-screen bg-background text-foreground">
      <p role="status">{statusError ? 'Your demo allowance could not be checked. Please try again.' : demoStatus?.inProgress ? 'Your demo generation is in progress. Return to the tab where you started it.' : 'Checking your free demo generation...'}</p>
      {statusError && <Button onClick={() => setStatusRefresh(value => value + 1)}>Try again</Button>}
      <Button variant="outline" onClick={goHome}>Go to Unison Home</Button>
    </section>;
  }

  const showChat = demoStatus?.remaining === 1 || launcherOpen;

  return (
    <div className="min-h-screen bg-background dark">
      <div className="flex justify-end" style={{ padding: "var(--ut-density-padding)" }}>
        <Button variant="outline" onClick={goHome}>
          <HomeIcon className="mr-2 h-4 w-4" />
          Go to Unison Home
        </Button>
      </div>

      {showChat ? (
        <HeroSection
          demoGeneration
          user={user}
          onAuthRequired={() => navigate("/auth")}
          onSiteConfirmed={(brief) => {
            try { writeSiteDiscoveryHandoff(user.id, brief); } catch { /* chat copy remains */ }
            setLaunchBrief(brief);
            setLauncherOpen(true);
          }}
          badge="Introducing Affinity · Unison's new Wizard AI"
          headline={<span className="block text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white">
            Try a Live Demo in{" "}
            <span className="bg-gradient-to-r from-cyan-300 via-fuchsia-400 to-lime-300 bg-clip-text text-transparent motion-safe:animate-pulse">
              Affinity
            </span>
          </span>}
          subtitle="Affinity is Unison's AI App Builder. Describe your business and watch it plan, design and generate your site live — your first generation is free."
          launcherOpen={launcherOpen}
          launchBrief={launchBrief}
          onLauncherOpenChange={(open) => {
            setLauncherOpen(open);
            setStatusRefresh(value => value + 1);
            if (!open) {
              setLaunchBrief(null);
              try { clearSiteDiscoveryHandoff(user.id); } catch { /* ignore */ }
            }
          }}
        />
      ) : (
        <section className="mx-auto flex w-full max-w-2xl flex-col" style={{ gap: "var(--ut-density-gap)", padding: "var(--ut-section-space)" }}>
          <p className="text-sm font-medium uppercase text-primary">Live Demo</p>
          <h1 className="text-3xl font-semibold">You've used your free demo generation.</h1>
          <p className="text-base text-muted-foreground">
            Your demo site is saved as a project draft. Open it any time from Unison Home.
          </p>
          <div>
            <Button onClick={goHome}>Open Unison Home</Button>
          </div>
        </section>
      )}
    </div>
  );
}
