import { useEffect, useState, useRef, Suspense, lazy, Component, type ReactNode, type ErrorInfo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FolderOpen, AlertTriangle, RefreshCw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VFSProvider } from "@/contexts/VFSContext";
import type { GraphicBrief } from "@/components/creatives/graphic-studio/AffinityGraphicStudio";

// Dynamic imports for heavy components
const DesignStudio = lazy(() => import("@/components/creatives/DesignStudio").then(m => ({ default: m.DesignStudio })));
const WebBuilder = lazy(() => import("@/components/creatives/WebBuilder").then(m => ({ default: m.WebBuilder })));
const AffinityGraphicStudio = lazy(() => import("@/components/creatives/graphic-studio/AffinityGraphicStudio").then(m => ({ default: m.AffinityGraphicStudio })));
const FileBrowser = lazy(() => import("@/components/creatives/design-studio/FileBrowser").then(m => ({ default: m.FileBrowser })));

class VFSErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[VFS] Render error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center bg-background">
          <div className="text-center max-w-md p-8">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Design Studio failed to load</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type StudioTab = "affinity" | "canvas" | "web";

/** Brief handed over from the Home Affinity chat (router state). */
function readGraphicBrief(state: unknown): GraphicBrief | null {
  const brief = (state as { graphicBrief?: Partial<GraphicBrief> } | null)?.graphicBrief;
  return brief && typeof brief.prompt === "string" && brief.prompt.trim() && typeof brief.formatId === "string"
    ? { prompt: brief.prompt.trim(), formatId: brief.formatId }
    : null;
}

const DesignStudioPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [graphicBrief] = useState(() => readGraphicBrief(location.state));
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false);
  const designStudioRef = useRef<{ addImageFromUrl: (url: string) => void } | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>("affinity");

  // The brief is consumed once; a refresh must not design it again.
  useEffect(() => {
    if (graphicBrief) navigate(location.pathname + location.search, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <VFSErrorBoundary>
    <VFSProvider>
    <div className="h-screen w-full flex flex-col bg-gray-50 overflow-hidden">
      <header className="h-10 sm:h-12 border-b border-gray-200 bg-white flex items-center justify-between px-2 sm:px-4 shrink-0 min-w-0">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-shrink">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/creatives")}
            className="h-7 sm:h-8 px-2"
          >
            <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <h1 className="text-sm sm:text-lg font-semibold truncate">Design Studio</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFileBrowserOpen(true)}
          className="h-7 sm:h-8 px-2 flex-shrink-0"
        >
          <FolderOpen className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
          <span className="hidden sm:inline">Browse Files</span>
        </Button>
      </header>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StudioTab)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TabsList className="mx-2 sm:mx-4 mt-1 sm:mt-2 w-fit h-8 flex-shrink-0">
          <TabsTrigger value="affinity" className="text-xs sm:text-sm h-7 px-2 sm:px-3">Affinity Graphics</TabsTrigger>
          <TabsTrigger value="canvas" className="text-xs sm:text-sm h-7 px-2 sm:px-3">Canvas Studio</TabsTrigger>
          <TabsTrigger value="web" className="text-xs sm:text-sm h-7 px-2 sm:px-3">Web Builder</TabsTrigger>
        </TabsList>
        
        {/* Kept mounted so the design survives switching tabs. */}
        <div role="tabpanel" aria-label="Affinity Graphics" hidden={activeTab !== "affinity"} className="flex-1 mt-0 min-h-0 overflow-hidden">
          <Suspense fallback={<div className="flex items-center justify-center h-full">Loading Affinity Graphics...</div>}>
            <AffinityGraphicStudio initialBrief={graphicBrief} />
          </Suspense>
        </div>

        <TabsContent value="canvas" className="flex-1 mt-0 overflow-hidden">
          <Suspense fallback={<div className="flex items-center justify-center h-full">Loading Canvas Studio...</div>}>
            <DesignStudio ref={designStudioRef} onOpenAffinity={() => setActiveTab("affinity")} />
          </Suspense>
        </TabsContent>
        
        <TabsContent value="web" className="flex-1 mt-0 overflow-hidden">
          <Suspense fallback={<div className="flex items-center justify-center h-full">Loading Web Builder...</div>}>
            <WebBuilder />
          </Suspense>
        </TabsContent>
      </Tabs>

      <Suspense fallback={null}>
        <FileBrowser 
          open={fileBrowserOpen} 
          onOpenChange={setFileBrowserOpen}
          onImageSelect={(imageUrl) => designStudioRef.current?.addImageFromUrl(imageUrl)}
        />
      </Suspense>
    </div>
    </VFSProvider>
    </VFSErrorBoundary>
  );
};

export default DesignStudioPage;
