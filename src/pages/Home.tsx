import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { ArrowRight, FolderKanban, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth?next=%2Fhome", { replace: true });
    }
  }, [loading, navigate, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground" role="status">
        Loading your Unison Home...
      </div>
    );
  }

  return (
    <section className="mx-auto flex min-h-[55vh] w-full max-w-4xl flex-col justify-center gap-8 py-10">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase text-primary">Unison Home</p>
        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">Build with focus. Launch with confidence.</h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          Your workspace starts here. Open Cloud Projects to manage your saved sites, or continue to Dashboard.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => navigate("/cloud", { state: { tab: "projects" } })}>
          <FolderKanban className="mr-2 h-4 w-4" />
          Open Cloud Projects
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          <LayoutDashboard className="mr-2 h-4 w-4" />
          Dashboard
        </Button>
      </div>
    </section>
  );
}