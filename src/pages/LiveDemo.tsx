import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Home as HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { HeroSection } from "@/components/home/sections";
import { clearSiteDiscoveryHandoff, writeSiteDiscoveryHandoff } from "@/components/ai/siteDiscoveryPersistence";

/** One free demo generation per account on this browser. */
const demoUsedKey = (userId: string) => `unison.demo.generationUsed.${userId}`;
function readDemoUsed(userId: string): boolean {
  try { return localStorage.getItem(demoUsedKey(userId)) === "1"; } catch { return false; }
}
function markDemoUsed(userId: string): void {
  try { localStorage.setItem(demoUsedKey(userId), "1"); } catch { /* storage unavailable */ }
}

export default function LiveDemo() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launchBrief, setLaunchBrief] = useState<string | null>(null);
  const [demoUsed, setDemoUsed] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (session?.user) setDemoUsed(readDemoUsed(session.user.id));
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

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

  const showChat = !demoUsed || launcherOpen;

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
          user={user}
          onAuthRequired={() => navigate("/auth")}
          onSiteConfirmed={(brief) => {
            markDemoUsed(user.id);
            setDemoUsed(true);
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
