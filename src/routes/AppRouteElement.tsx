import { AsyncRouteLoadingFallback, RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { RouteShellFrame } from "@/components/shell";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { stashGuestDemoUser } from "@/services/guestDemoClaim";
import { RouteMetaProvider } from "./RouteMetaContext";
import { RouteRuntimeProvider } from "./RouteRuntimeContext";
import { resolveRouteAccess } from "./routeAccessPolicy";
import { getRouteShellActivationOptionsFromEnv, isRouteShellEnabled } from "./routeShellActivation";
import type { AppRouteConfig, AppRouteMeta } from "./routeConfig";

const APP_TITLE = "Unison";

export function getRouteDocumentTitle(meta: AppRouteMeta) {
  return meta.title === APP_TITLE ? APP_TITLE : `${meta.title} | ${APP_TITLE}`;
}

interface AppRouteElementProps {
  route: AppRouteConfig;
}

function RouteAccessGate({ meta, children }: { meta: AppRouteMeta; children: ReactNode }) {
  const location = useLocation();
  const [sessionState, setSessionState] = useState({
    loading: meta.requiresAuth === true,
    authenticated: false,
    anonymous: false,
  });

  useEffect(() => {
    if (!meta.requiresAuth) {
      setSessionState({ loading: false, authenticated: false, anonymous: false });
      return;
    }

    let active = true;
    const applySession = (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      if (!active) return;
      stashGuestDemoUser(session?.user?.id ?? null, session?.user?.is_anonymous === true);
      setSessionState({
        loading: false,
        authenticated: Boolean(session?.user && !session.user.is_anonymous),
        anonymous: session?.user.is_anonymous === true,
      });
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => applySession(session));
    void supabase.auth.getSession().then(({ data }) => applySession(data.session)).catch(() => applySession(null));

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [meta.requiresAuth]);

  const decision = resolveRouteAccess(meta, {
    isAuthenticated: sessionState.authenticated,
    isAnonymousUser: sessionState.anonymous,
    authLoading: sessionState.loading,
  });

  if (decision.kind === "loading") {
    return <AsyncRouteLoadingFallback label="Checking your account…" />;
  }

  if (decision.kind === "redirect" && decision.redirectTo) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`${decision.redirectTo}?next=${encodeURIComponent(next)}`} replace />;
  }

  return <>{children}</>;
}

export function AppRouteElement({ route }: AppRouteElementProps): ReactElement {
  const { meta, element } = route;
  const routeElement = isRouteShellEnabled(meta, getRouteShellActivationOptionsFromEnv()) ? (
    <RouteShellFrame>{element}</RouteShellFrame>
  ) : (
    element
  );

  useEffect(() => {
    const previousTitle = document.title;
    const previousRouteId = document.body.dataset.routeId;
    const previousRouteShell = document.body.dataset.routeShell;
    const previousRouteSection = document.body.dataset.routeSection;

    document.title = getRouteDocumentTitle(meta);
    document.body.dataset.routeId = meta.id;
    document.body.dataset.routeShell = meta.shell;
    document.body.dataset.routeSection = meta.section;

    return () => {
      document.title = previousTitle;

      if (previousRouteId) {
        document.body.dataset.routeId = previousRouteId;
      } else {
        delete document.body.dataset.routeId;
      }

      if (previousRouteShell) {
        document.body.dataset.routeShell = previousRouteShell;
      } else {
        delete document.body.dataset.routeShell;
      }

      if (previousRouteSection) {
        document.body.dataset.routeSection = previousRouteSection;
      } else {
        delete document.body.dataset.routeSection;
      }
    };
  }, [meta]);

  return (
    <RouteErrorBoundary routeName={meta.id}>
      <RouteMetaProvider meta={meta}>
        <RouteRuntimeProvider meta={meta}>
          <RouteAccessGate meta={meta}>{routeElement}</RouteAccessGate>
        </RouteRuntimeProvider>
      </RouteMetaProvider>
    </RouteErrorBoundary>
  );
}
