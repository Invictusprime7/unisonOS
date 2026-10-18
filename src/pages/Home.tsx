import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { ArrowRight, FolderKanban, LayoutDashboard, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface RecentProject {
  id: string;
  name: string;
  updated_at: string | null;
}

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);

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

  useEffect(() => {
    if (!user) return;
    let active = true;
    void supabase
      .from("projects")
      .select("id, name, updated_at")
      .order("updated_at", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (active && data) setRecentProjects(data as RecentProject[]);
      });
    return () => {
      active = false;
    };
  }, [user]);

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

      {recentProjects.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent projects</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {recentProjects.map((project) => (
              <li key={project.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="truncate text-sm font-medium text-foreground">{project.name || "Untitled project"}</span>
                <Button variant="outline" size="sm" onClick={() => navigate(`/project/${project.id}`)}>
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  Resume
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
