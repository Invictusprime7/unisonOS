import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { ArrowRight, Home as HomeIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export default function LiveDemo() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth?next=%2Fdemo", { replace: true });
    }
  }, [loading, navigate, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground" role="status">
        Preparing your live demo...
      </div>
    );
  }

  return (
    <section className="mx-auto flex min-h-[55vh] w-full max-w-3xl flex-col justify-center" style={{ gap: "var(--ut-density-gap)" }}>
      <div className="flex flex-col" style={{ gap: "var(--ut-density-gap)" }}>
        <p className="text-sm font-medium uppercase text-primary">Live Demo</p>
        <h1 className="text-3xl font-semibold tracking-normal sm:text-4xl">Welcome to Unison.</h1>
        <p className="max-w-2xl text-base text-muted-foreground">
          This is your guided first run. Describe your business, and Unison will shape a launch plan,
          generate your site, and let you edit everything live — pages, text, images, products and more.
        </p>
      </div>

      <div className="flex flex-col" style={{ gap: "var(--ut-density-gap)" }}>
        <div className="flex items-start" style={{ gap: "var(--ut-density-gap)" }}>
          <Sparkles className="mt-1 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-foreground">Tell the AI what you're building — it plans the pages, style and content with you.</p>
        </div>
        <div className="flex items-start" style={{ gap: "var(--ut-density-gap)" }}>
          <Sparkles className="mt-1 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-foreground">Watch your site appear in the live preview, then click anything to edit it.</p>
        </div>
        <div className="flex items-start" style={{ gap: "var(--ut-density-gap)" }}>
          <Sparkles className="mt-1 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-foreground">Save your project and pick it up any time from Unison Home.</p>
        </div>
      </div>

      <div className="flex flex-wrap" style={{ gap: "var(--ut-density-gap)" }}>
        <Button onClick={() => navigate("/web-builder")}>
          Start the live demo
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => navigate("/home")}>
          <HomeIcon className="mr-2 h-4 w-4" />
          Skip to Unison Home
        </Button>
      </div>
    </section>
  );
}
