import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { DirectionProvider } from "@radix-ui/react-direction";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { Analytics } from "@vercel/analytics/react";
import { useEffect } from "react";
import { LaunchProvider } from "@/contexts/LaunchContext";
import { useLaunch } from "@/contexts/useLaunchHooks";
import { AppRouteElement } from "@/routes/AppRouteElement";
import { appRoutes } from "@/routes/routeConfig";
import { SupabaseBootstrap } from "@/hooks/useSupabaseBootstrap";
import { readLauncherHandoff } from "@/services/launcherHandoffStore";

const queryClient = new QueryClient();

const LauncherHandoffRouteGuard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setLaunch } = useLaunch();

  useEffect(() => {
    // Preserve pending work without letting it hijack authentication.
    if (["/web-builder", "/home", "/demo"].includes(location.pathname) ||
      location.pathname === "/auth" || location.pathname.startsWith("/auth/")) return;

    const pendingHandoff = readLauncherHandoff();
    if (!pendingHandoff) return;

    if (pendingHandoff.launchState) {
      setLaunch(pendingHandoff.launchState);
    }

    navigate("/web-builder", {
      replace: true,
      state: pendingHandoff.routeState,
    });
  }, [location.pathname, navigate, setLaunch]);

  return null;
};

const App = () => (
  <RouteErrorBoundary routeName="root">
    <QueryClientProvider client={queryClient}>
      <DirectionProvider dir="ltr">
        <TooltipProvider>
          <LaunchProvider>
            <Sonner />
            <SupabaseBootstrap />
            <BrowserRouter>
            <LauncherHandoffRouteGuard />
            <Routes>
              {appRoutes.map((route) => (
                <Route
                  key={route.meta.id}
                  path={route.path}
                  element={<AppRouteElement route={route} />}
                />
              ))}
          </Routes>
        </BrowserRouter>
        <Analytics />
          </LaunchProvider>
      </TooltipProvider>
    </DirectionProvider>
  </QueryClientProvider>
  </RouteErrorBoundary>
);

export default App;
