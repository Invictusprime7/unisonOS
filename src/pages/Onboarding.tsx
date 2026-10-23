import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { LauncherWizard } from "@/components/onboarding/wizard/LauncherWizard";
import { BusinessProfileGate } from "@/components/onboarding/BusinessProfileGate";
import type { BusinessProfileDTO } from "@/types/businessProfile";
import { Button } from "@/components/ui/button";
import { Zap, ArrowRight, CheckSquare } from "lucide-react";

/**
 * Full-screen onboarding page.
 * Shown to new users after signup, or to returning users with no completed projects.
 * Opens the LauncherWizard wizard immediately so the user can build their first site.
 * 
 * Note: Route protection via requiresAuth ensures only authenticated users can access this page.
 */
const Onboarding = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [prefill, setPrefill] = useState<{
    businessId: string;
    businessName: string | null;
    industry: string | null;
    notificationEmail: string | null;
    email?: string | null;
    phone?: string | null;
    notificationPhone?: string | null;
    socialLinks?: Record<string, string> | null;
    tagline?: string | null;
    description?: string | null;
    website?: string | null;
    logoUrl?: string | null;
    brandColor?: string | null;
    timezone?: string | null;
    address?: BusinessProfileDTO['address'] | null;
    hours?: BusinessProfileDTO['hours'] | null;
  } | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (!session) navigate("/auth");
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLauncherClose = (open: boolean) => {
    setLauncherOpen(open);
    // If user closes the launcher, they can still explore or skip
  };

  const handleSkip = () => {
    // Strict enforcement: onboarding always exits into the builder, never the
    // unison tasks dashboard. The dashboard is reachable from the builder shell
    // but is never the post-launch destination.
    navigate("/web-builder");
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#070711]">
        <Zap className="h-8 w-8 text-cyan-400 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070711] text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <CheckSquare className="h-6 w-6 text-cyan-400" />
          <span className="font-bold text-lg tracking-tight">Unison</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-white/40 hover:text-white/70 text-xs"
          onClick={handleSkip}
        >
          Skip for now
        </Button>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {["Industry", "Business Name", "Preview", "Launch"].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border ${
                i === 0
                  ? "border-cyan-400 text-cyan-400 bg-cyan-400/10"
                  : "border-white/10 text-white/30"
              }`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  i === 0 ? "bg-cyan-400 text-black" : "bg-white/10"
                }`}>{i + 1}</span>
                {label}
              </div>
              {i < 3 && <div className="w-4 h-px bg-white/10" />}
            </div>
          ))}
        </div>

        {/* Hero */}
        <div className="max-w-xl mb-10">
          <div className="inline-flex items-center gap-2 bg-cyan-400/10 border border-cyan-400/20 rounded-full px-4 py-1.5 text-cyan-400 text-xs font-medium mb-6">
            <Zap className="h-3 w-3" />
            Welcome{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}!
          </div>
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            Let's build your <span className="text-cyan-400">business site</span>
          </h1>
          <p className="text-white/50 text-base leading-relaxed">
            Choose your industry and we'll generate a complete site with built-in CRM, automations, and booking — ready in under 60 seconds.
          </p>
        </div>

        {/* CTA */}
        <Button
          size="lg"
          className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-8 py-6 text-base rounded-xl shadow-[0_0_30px_rgba(0,200,255,0.3)] transition-all hover:shadow-[0_0_40px_rgba(0,200,255,0.5)] group"
          onClick={() => setGateOpen(true)}
        >
          Start Building
          <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </Button>

        {/* Feature chips */}
        <div className="flex flex-wrap justify-center gap-2 mt-8">
          {["CRM Included", "Automation Ready", "Booking System", "Team Access", "Custom Domain"].map(f => (
            <span
              key={f}
              className="text-xs text-white/40 border border-white/10 px-3 py-1 rounded-full"
            >
              {f}
            </span>
          ))}
        </div>
      </main>

      {/* LauncherWizard dialog (default path with theme aesthetic cards) */}
      <BusinessProfileGate
        open={gateOpen}
        onOpenChange={setGateOpen}
        onReady={(businessId, profile: BusinessProfileDTO) => {
          setPrefill({
            businessId,
            businessName: profile?.name ?? null,
            industry: profile?.industry ?? null,
            notificationEmail: profile?.notificationEmail ?? null,
            email: profile?.email ?? null,
            phone: profile?.phone ?? null,
            notificationPhone: profile?.notificationPhone ?? null,
            socialLinks: profile?.socialLinks ?? null,
            tagline: profile?.tagline ?? null,
            description: profile?.description ?? null,
            website: profile?.website ?? null,
            logoUrl: profile?.logoUrl ?? null,
            brandColor: profile?.brandColor ?? null,
            timezone: profile?.timezone ?? null,
            address: profile?.address ?? null,
            hours: profile?.hours ?? null,
          });
          setGateOpen(false);
          setLauncherOpen(true);
        }}
      />
      <LauncherWizard open={launcherOpen} onOpenChange={handleLauncherClose} prefill={prefill} draftScope={user?.id ?? 'anonymous'} />
    </div>
  );
};

export default Onboarding;
