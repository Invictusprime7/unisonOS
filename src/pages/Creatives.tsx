import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Search, 
  Sparkles, 
  Image, 
  FileText, 
  Video, 
  Cloud, 
  CheckSquare, 
  Maximize2,
  Palette,
  Globe,
  ArrowRight,
  LogOut,
  Workflow,
  CalendarDays
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { ImageEditor } from "@/components/creatives/ImageEditor";
import { VideoEditor } from "@/components/creatives/VideoEditor";
import { CreativeTaskSelector } from "@/components/creatives/CreativeTaskSelector";
import { SubscriptionBadge } from "@/components/SubscriptionBadge";
import { User } from "@supabase/supabase-js";

const Creatives = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
    navigate("/home");
  };

  const { data: creativeTasks, isLoading } = useQuery({
    queryKey: ["creative-tasks", searchQuery],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let query = supabase
        .from("tasks")
        .select(`*, projects(name, id)`)
        .in("status", ["todo", "in_progress"])
        .order("created_at", { ascending: false });
      
      if (searchQuery) {
        query = query.ilike("title", `%${searchQuery}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const categorizedTasks = {
    design: creativeTasks?.filter(t => 
      t.title.toLowerCase().includes("design") || 
      t.description?.toLowerCase().includes("design")
    ) || [],
    content: creativeTasks?.filter(t => 
      t.title.toLowerCase().includes("content") || 
      t.title.toLowerCase().includes("write") || 
      t.description?.toLowerCase().includes("content")
    ) || [],
    media: creativeTasks?.filter(t => 
      t.title.toLowerCase().includes("video") || 
      t.title.toLowerCase().includes("image") || 
      t.description?.toLowerCase().includes("media")
    ) || []
  };

  const creativeTools = [
    { icon: Palette, title: "Design Studio", desc: "Professional design tools", path: "/design-studio" },
    { icon: Globe, title: "Web Builder", desc: "AI-powered websites", path: "/web-builder" },
    { icon: Sparkles, title: "Launch a system", desc: "Wizard-generated business site", path: "/onboarding" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation - matching /home style */}
      <nav className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">Unison</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => navigate("/home")} className="text-muted-foreground hover:text-foreground transition-colors">Home</button>
            <button onClick={() => navigate("/crm")} className="text-muted-foreground hover:text-foreground transition-colors">CRM</button>
            <button onClick={() => navigate("/planning")} className="text-muted-foreground hover:text-foreground transition-colors">Planning</button>
            <button onClick={() => navigate("/files")} className="text-muted-foreground hover:text-foreground transition-colors">Files</button>
          </div>
          <div className="flex items-center gap-3">
            {user && <SubscriptionBadge />}
            {user ? (
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            ) : (
              <Button onClick={() => navigate("/auth")}>
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-12 md:py-20">
        <div className="text-center max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-6">
            <Sparkles className="h-3 w-3 mr-1" />
            Creative Suite
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground leading-tight">
            Creative Tasks
            <span className="block text-primary">Design, Build & Create</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Access professional content creation tools with AI-powered features. 
            Design stunning visuals, build websites, and manage creative projects.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => setSelectorOpen(true)} className="text-lg px-8">
              <Plus className="mr-2 h-5 w-5" />
              New Creative Task
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/web-builder")} className="text-lg px-8">
              Open Web Builder
            </Button>
          </div>
        </div>
      </section>

      {/* Quick Access Tools */}
      <section className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {creativeTools.map((tool, i) => (
            <Card 
              key={i} 
              className="cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 border-border/50 group"
              onClick={() => navigate(tool.path)}
            >
              <CardContent className="pt-6 text-center">
                <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                  <tool.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">{tool.title}</h3>
                <p className="text-sm text-muted-foreground">{tool.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Content Cloud Section */}
      <section className="bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Cloud className="h-8 w-8 text-primary" />
              <h2 className="text-3xl font-bold">Content Cloud</h2>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Professional content creation tools at your fingertips
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            <ImageEditor />
            
            <Card className="group hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary/50 bg-background">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Design Studio
                  </span>
                  <Maximize2 className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardTitle>
                <CardDescription>
                  Create stunning designs with professional tools
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => navigate("/design-studio")} className="w-full">
                  Open Full Studio
                </Button>
              </CardContent>
            </Card>
            
            <VideoEditor />
          </div>
        </div>
      </section>

      {/* Tasks Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Your Creative Tasks</h2>
              <p className="text-muted-foreground">Manage and track your creative projects</p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search creative tasks..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="pl-10"
              />
            </div>
          </div>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4 max-w-lg">
              <TabsTrigger value="all">All Tasks</TabsTrigger>
              <TabsTrigger value="design" className="flex items-center gap-1">
                <Image className="h-4 w-4" />
                Design
              </TabsTrigger>
              <TabsTrigger value="content" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                Content
              </TabsTrigger>
              <TabsTrigger value="media" className="flex items-center gap-1">
                <Video className="h-4 w-4" />
                Media
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4 mt-6">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading tasks...</p>
                </div>
              ) : creativeTasks && creativeTasks.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {creativeTasks.map(task => (
                    <Card 
                      key={task.id} 
                      className="hover:shadow-lg transition-shadow cursor-pointer border-border/50"
                      onClick={() => navigate(`/project/${task.project_id}`)}
                    >
                      <CardHeader>
                        <CardTitle className="line-clamp-1 text-lg">{task.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {task.description || "No description"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {task.projects?.name}
                          </span>
                          <Badge variant={task.status === "todo" ? "secondary" : "default"}>
                            {task.status === "todo" ? "To Do" : "In Progress"}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-border/50">
                  <CardContent className="py-12 text-center">
                    <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">No creative tasks found</p>
                    <Button onClick={() => setSelectorOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Task
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="design" className="space-y-4 mt-6">
              {categorizedTasks.design.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {categorizedTasks.design.map(task => (
                    <Card 
                      key={task.id} 
                      className="hover:shadow-lg transition-shadow cursor-pointer border-border/50"
                      onClick={() => navigate(`/project/${task.project_id}`)}
                    >
                      <CardHeader>
                        <CardTitle className="line-clamp-1 text-lg">{task.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {task.description || "No description"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <span className="text-sm text-muted-foreground">
                          {task.projects?.name}
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    No design tasks found
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="content" className="space-y-4 mt-6">
              {categorizedTasks.content.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {categorizedTasks.content.map(task => (
                    <Card 
                      key={task.id} 
                      className="hover:shadow-lg transition-shadow cursor-pointer border-border/50"
                      onClick={() => navigate(`/project/${task.project_id}`)}
                    >
                      <CardHeader>
                        <CardTitle className="line-clamp-1 text-lg">{task.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {task.description || "No description"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <span className="text-sm text-muted-foreground">
                          {task.projects?.name}
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    No content tasks found
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="media" className="space-y-4 mt-6">
              {categorizedTasks.media.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {categorizedTasks.media.map(task => (
                    <Card 
                      key={task.id} 
                      className="hover:shadow-lg transition-shadow cursor-pointer border-border/50"
                      onClick={() => navigate(`/project/${task.project_id}`)}
                    >
                      <CardHeader>
                        <CardTitle className="line-clamp-1 text-lg">{task.title}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {task.description || "No description"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <span className="text-sm text-muted-foreground">
                          {task.projects?.name}
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-border/50">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    No media tasks found
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">Unison</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <button onClick={() => navigate("/home")} className="hover:text-foreground transition-colors">Home</button>
              <button onClick={() => navigate("/pricing")} className="hover:text-foreground transition-colors">Pricing</button>
              <button onClick={() => navigate("/crm")} className="hover:text-foreground transition-colors">CRM</button>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Unison. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <CreativeTaskSelector open={selectorOpen} onOpenChange={setSelectorOpen} />
    </div>
  );
};

export default Creatives;
