import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { claimGuestDemoIfNeeded } from "@/services/guestDemoClaim";
import { ArrowLeft, Check, Sparkles, Zap } from "lucide-react";
import "./Auth.css";

const AuthLaunchDemoSequence = ({ duplicate = false }: { duplicate?: boolean }) => (
  <div className="auth-launch-demo-sequence space-y-3 px-4 py-4" aria-hidden={duplicate || undefined}>
    <div className="flex justify-end">
      <p className="max-w-[88%] rounded-lg bg-cyan-400/15 px-3 py-2 text-left text-xs leading-5 text-cyan-50">
        I'm opening a coffee shop and need a site with online orders.
      </p>
    </div>
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 text-cyan-300">
        <Sparkles className="h-3.5 w-3.5" />
      </span>
      <p className="max-w-[88%] rounded-lg bg-white/[0.06] px-3 py-2 text-left text-xs leading-5 text-slate-200">
        Great. I'll shape a launch plan around your business and goals.
      </p>
    </div>
    <div className="pt-1">
      <div className="auth-demo-floating-divider mx-auto mb-2 h-1 w-14 rounded-full bg-cyan-300/70 shadow-[0_0_12px_rgba(103,232,249,0.45)]" aria-hidden="true" />
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">Launcher Wizard</span>
        <span className="text-[10px] text-cyan-300">Step 1 of 4</span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          ["01", "Industry"],
          ["02", "Goals"],
          ["03", "Pages"],
          ["04", "Style"],
        ].map(([number, label], index) => (
          <div key={number} className="min-w-0">
            <span className={`mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] ${index === 0 ? "bg-cyan-400 text-[#080c1b]" : "border border-slate-600 text-slate-400"}`}>
              {number}
            </span>
            <span className="block truncate text-[10px] text-slate-400">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-slate-700/80 pt-3 text-[10px] text-slate-300">
        <Check className="h-3.5 w-3.5 text-cyan-300" />
        <span>Your launch plan is taking shape</span>
        <span className="ml-auto flex gap-1" aria-hidden="true">
          <span className="h-1 w-1 animate-pulse rounded-full bg-cyan-300" />
          <span className="h-1 w-1 animate-pulse rounded-full bg-cyan-300 [animation-delay:150ms]" />
          <span className="h-1 w-1 animate-pulse rounded-full bg-cyan-300 [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  </div>
);

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const signInFormRef = useRef<HTMLFormElement>(null);

  const newSignupRef = useRef(false);

  // Successful sign-in opens Home, not a stale project/dashboard return link.
  const resolvePostAuthDestination = async (userId: string, isNewSignup = false): Promise<string> => {
    if (isNewSignup) return "/demo";
    try {
      const next = new URLSearchParams(window.location.search).get("next");
      if (next?.startsWith("/") && !next.startsWith("//") && !next.includes("\\")) {
        const pathname = new URL(next, window.location.origin).pathname;
        if (["/demo", "/pricing", "/oauth/consent"].includes(pathname)) return next;
      }
      if (sessionStorage.getItem("checkout_plan")) {
        sessionStorage.removeItem("checkout_plan");
        return "/pricing";
      }
    } catch {
      // Unavailable storage must not strand successful authentication.
    }
    const controller = new AbortController();
    let lookupTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const lookup = supabase.from("onboarding_state").select("completed")
        .eq("user_id", userId).abortSignal(controller.signal).maybeSingle()
        .then(({ data, error }) => error ? "/home" : data?.completed ? "/home" : "/demo");
      const fallback = new Promise<string>((resolve) => {
        lookupTimer = setTimeout(() => {
          resolve("/home");
          controller.abort();
        }, 4000);
      });
      return await Promise.race([lookup, fallback]);
    } catch {
      return "/home";
    } finally {
      clearTimeout(lookupTimer);
    }
  };

  useEffect(() => {
    let handled = false;
    let active = true;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRedirect = (userId: string, isNewSignup = false) => {
      if (!active || handled) return;
      handled = true;
      // Auth listeners execute under the SDK session lock. Database/auth work
      // must start on a later task, after that lock has been released.
      redirectTimer = setTimeout(() => {
        // Legacy demo recovery must never be a navigation prerequisite.
        void claimGuestDemoIfNeeded(userId).catch(() => undefined);
        void resolvePostAuthDestination(userId, isNewSignup)
          .then((dest) => {
          if (active) navigate(dest, { replace: true });
        }).catch(() => {
          if (active) navigate("/home", { replace: true });
        });
      }, 0);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Anonymous guest sessions must not trigger a redirect: protected routes
      // bounce them back to /auth, which would loop forever.
      if (session && session.user.is_anonymous !== true) {
        scheduleRedirect(session.user.id, newSignupRef.current);
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && session.user.is_anonymous !== true) scheduleRedirect(session.user.id, newSignupRef.current);
    }).catch(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      clearTimeout(redirectTimer);
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("signup-email") as string;
    const password = formData.get("signup-password") as string;
    const fullName = formData.get("full-name") as string;

    newSignupRef.current = true;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth?next=%2Fdemo`,
        data: {
          full_name: fullName,
        },
      },
    });

    setLoading(false);

    if (error) {
      newSignupRef.current = false;
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account created!",
        description: "You can now sign in to your account.",
      });
    }
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("signin-email") as string;
    const password = formData.get("signin-password") as string;

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      toast({
        title: "Sign in failed",
        description: error instanceof Error ? error.message : "Unable to sign in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordRecovery = async () => {
    const email = new FormData(signInFormRef.current ?? undefined).get("signin-email") as string | null;

    if (!email) {
      toast({
        title: "Enter your email",
        description: "Enter the email address for the account you want to recover.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setLoading(false);

    if (error) {
      toast({
        title: "Password reset failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Check your email",
      description: "If an account exists for that address, you will receive a password reset link.",
    });
  };

  return (
    <main className="min-h-screen bg-[#080c1b] text-white lg:grid lg:grid-cols-[1.02fr_0.98fr]">
      <aside className="relative flex min-h-[480px] flex-col items-center justify-start gap-7 overflow-hidden bg-[#080c1b] px-6 py-12 text-white lg:min-h-screen lg:px-14 lg:pt-16">
        <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(95,145,205,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(95,145,205,0.12)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
        <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
          <img
            src="/unison-logo-lockup.png"
            alt="Unison, intent-driven AI app builder"
            className="mb-4 h-auto w-full max-w-[360px] object-contain"
          />
          <p className="max-w-md font-sans text-2xl font-semibold leading-tight tracking-normal text-white sm:text-[32px]">
            Build with focus.<br />
            <span className="text-cyan-300">Launch with confidence</span>
          </p>
          <p className="mt-4 max-w-md text-base leading-7 text-slate-300">
            Tell Unison what your business needs. See it live.
          </p>
        </div>
        <section aria-label="AI chat and Launcher Wizard demo" className="relative z-10 w-full max-w-lg overflow-hidden bg-[#0d1324]/95 shadow-[0_16px_48px_rgba(0,0,0,0.2)]">
          <div className="flex items-center justify-between border-b border-slate-700/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              <span className="text-xs font-semibold text-slate-100">From chat to launch</span>
            </div>
            <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-cyan-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
              Live demo
            </span>
          </div>
          <div className="auth-launch-demo-viewport h-[220px] overflow-hidden" aria-label="A sample AI conversation flows into the Launcher Wizard">
            <div className="auth-launch-demo-track">
              <AuthLaunchDemoSequence />
              <AuthLaunchDemoSequence duplicate />
            </div>
          </div>
        </section>
      </aside>

      <section className="relative flex min-h-screen items-center justify-center px-6 py-20 sm:px-10 lg:px-14">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="absolute left-6 top-6 gap-2 text-slate-400 hover:text-white sm:left-10 lg:left-14"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Button>

        <div className="w-full max-w-[420px]">
          <header className="mb-9">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Your workspace starts here</p>
            <h1 className="font-sans text-2xl font-semibold tracking-normal text-white sm:text-3xl">Welcome back</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">Sign in or create an account to get started.</p>
          </header>

          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid h-12 w-full grid-cols-2 rounded-none border-b border-slate-700 bg-transparent p-0">
              <TabsTrigger
                value="signin"
                className="h-full rounded-none border-b-2 border-transparent bg-transparent font-semibold text-slate-400 shadow-none transition-colors data-[state=active]:border-cyan-400 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                Sign in
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="h-full rounded-none border-b-2 border-transparent bg-transparent font-semibold text-slate-400 shadow-none transition-colors data-[state=active]:border-cyan-400 data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                Create account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-7">
              <form ref={signInFormRef} onSubmit={handleSignIn} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="font-medium text-slate-200">Email</Label>
                  <Input
                    id="signin-email"
                    name="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    className="h-12 border-slate-700 bg-[#111827] text-white placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="font-medium text-slate-200">Password</Label>
                  <Input
                    id="signin-password"
                    name="signin-password"
                    type="password"
                    placeholder="Enter your password"
                    required
                    className="h-12 border-slate-700 bg-[#111827] text-white placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/20"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-sm font-medium text-cyan-300 hover:text-cyan-200"
                    onClick={handlePasswordRecovery}
                    disabled={loading}
                  >
                    Forgot password?
                  </Button>
                </div>
                <Button
                  type="submit"
                  className="h-12 w-full bg-cyan-600 font-semibold text-white shadow-none transition-colors hover:bg-cyan-700"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Zap className="h-4 w-4 animate-pulse" />
                      Signing in...
                    </span>
                  ) : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-7">
              <form onSubmit={handleSignUp} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="full-name" className="font-medium text-slate-200">Full name</Label>
                  <Input
                    id="full-name"
                    name="full-name"
                    type="text"
                    placeholder="Your name"
                    required
                    className="h-12 border-slate-700 bg-[#111827] text-white placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email" className="font-medium text-slate-200">Email</Label>
                  <Input
                    id="signup-email"
                    name="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    className="h-12 border-slate-700 bg-[#111827] text-white placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="font-medium text-slate-200">Password</Label>
                  <Input
                    id="signup-password"
                    name="signup-password"
                    type="password"
                    placeholder="Create a password"
                    required
                    minLength={6}
                    className="h-12 border-slate-700 bg-[#111827] text-white placeholder:text-slate-500 focus-visible:border-cyan-400 focus-visible:ring-cyan-400/20"
                  />
                </div>
                <Button
                  type="submit"
                  className="h-12 w-full bg-cyan-600 font-semibold text-white shadow-none transition-colors hover:bg-cyan-700"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Zap className="h-4 w-4 animate-pulse" />
                      Creating account...
                    </span>
                  ) : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </section>

    </main>
  );
};

export default Auth;