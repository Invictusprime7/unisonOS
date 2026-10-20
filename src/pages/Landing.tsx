import { useEffect, lazy, Suspense } from "react";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { UnisonLoadingMark } from "@/components/UnisonLoadingMark";

// Preload the Index component to avoid loading delay after redirect
const Index = lazy(() => import("./Index"));

// Loading component matching the app style
const LandingLoader = () => (
  <div className="h-screen w-full flex items-center justify-center bg-slate-900">
    <div className="text-center">
      <UnisonLoadingMark size={48} className="mx-auto mb-4" />
      <p className="text-slate-400">Loading Unison...</p>
    </div>
  </div>
);

// Landing page renders Index directly instead of redirecting
const Landing = () => {
  // Start preloading as soon as component mounts
  useEffect(() => {
    // Preload critical chunks
    import("./Index");
  }, []);

  return (
    <RouteErrorBoundary routeName="landing">
      <Suspense fallback={<LandingLoader />}>
        <Index />
      </Suspense>
    </RouteErrorBoundary>
  );
};

export default Landing;
