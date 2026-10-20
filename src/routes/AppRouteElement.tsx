import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { RouteShellFrame } from "@/components/shell";
import { useEffect, type ReactElement } from "react";
import { RouteMetaProvider } from "./RouteMetaContext";
import { RouteRuntimeProvider } from "./RouteRuntimeContext";
import { getRouteShellActivationOptionsFromEnv, isRouteShellEnabled } from "./routeShellActivation";
import type { AppRouteConfig, AppRouteMeta } from "./routeConfig";

const APP_TITLE = "Unison";

export function getRouteDocumentTitle(meta: AppRouteMeta) {
  return meta.title === APP_TITLE ? APP_TITLE : `${meta.title} | ${APP_TITLE}`;
}

interface AppRouteElementProps {
  route: AppRouteConfig;
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
        <RouteRuntimeProvider meta={meta}>{routeElement}</RouteRuntimeProvider>
      </RouteMetaProvider>
    </RouteErrorBoundary>
  );
}
