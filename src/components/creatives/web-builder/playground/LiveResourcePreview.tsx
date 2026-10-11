import { useEffect, useRef, useState } from "react";
import type { PlaygroundAppearance } from "@/hooks/usePlaygroundApi";
import { cn } from "@/lib/utils";

type PreviewKind = "page" | "resource" | "component";

interface LiveRuntimePreviewProps {
  kind: PreviewKind;
  targetId?: string;
  name?: string;
  route?: string;
  componentSlug?: string;
  className?: string;
}

interface RuntimeSnapshot { html: string; css: string }

function findBuilderRuntimeSource(): string | null {
  const candidates = document.querySelectorAll<HTMLIFrameElement>(
    "[data-unison-preview-runtime] iframe.sp-preview-iframe, [data-unison-preview-runtime] .sp-preview iframe, [data-unison-preview-runtime] iframe[title*='Sandpack'], [data-unison-preview-runtime] iframe[title='VFS Preview'], iframe.sp-preview-iframe, iframe[title='VFS Preview']",
  );
  for (const frame of candidates) {
    if (frame.hasAttribute("data-playground-runtime-preview") || frame.closest("[data-playground-preview-card]")) continue;
    if (frame.src && frame.src !== "about:blank") return frame.src;
  }
  return null;
}

function snapshotDocument(snapshot: RuntimeSnapshot): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${snapshot.css}</style><style>html,body{margin:0;min-height:100%;overflow:hidden}body{display:grid;place-items:center;background:transparent}body>*{width:100%;max-width:100%}</style></head><body>${snapshot.html}</body></html>`;
}

/** Compact, read-only views powered by the same generated-site runtime as the Builder. */
export function LiveRuntimePreview({ kind, targetId, name, route = "/", componentSlug, className = "h-48" }: LiveRuntimePreviewProps) {
  const runtimeRef = useRef<HTMLIFrameElement>(null);
  const requestIdRef = useRef(`playground-graph-${crypto.randomUUID()}`);
  const [runtimeSource, setRuntimeSource] = useState<string | null>(() => findBuilderRuntimeSource());
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot | null | "missing">(null);

  useEffect(() => {
    if (runtimeSource) return;
    let attempts = 0;
    const timer = window.setInterval(() => {
      const source = findBuilderRuntimeSource();
      if (source) {
        setRuntimeSource(source);
        window.clearInterval(timer);
      } else if (++attempts >= 30) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [runtimeSource]);

  useEffect(() => {
    setSnapshot(null);
    if (kind === "page" || !runtimeSource) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; requestId?: string; html?: string | null; css?: string | null };
      if (event.source !== runtimeRef.current?.contentWindow || data?.type !== "PLAYGROUND_GRAPH_SNAPSHOT" || data.requestId !== requestIdRef.current) return;
      setSnapshot(data.html ? { html: data.html, css: data.css ?? "" } : "missing");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [kind, runtimeSource, targetId, componentSlug, name, route]);

  const requestSnapshot = () => {
    const target = runtimeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage({ type: "NAV_ROUTE", route }, "*");
    if (kind === "page") return;
    const send = () => target.postMessage({ type: "SNAPSHOT_PLAYGROUND_GRAPH", requestId: requestIdRef.current, kind, targetId, componentSlug, name }, "*");
    window.setTimeout(send, 350);
    window.setTimeout(send, 1100);
    window.setTimeout(send, 2200);
  };

  if (!runtimeSource) return <div className={cn(className, "grid place-items-center bg-[radial-gradient(circle_at_70%_20%,rgba(52,211,153,.15),transparent_45%),#070c10] text-[10px] text-white/35")}>Connecting to live preview…</div>;

  return (
    <div data-playground-preview-card className={cn(className, "relative isolate overflow-hidden bg-[#070c10]")}>
      <iframe
        ref={runtimeRef}
        data-playground-runtime-preview
        title={`Live ${kind} runtime for ${name ?? targetId ?? route}`}
        src={runtimeSource}
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
        tabIndex={-1}
        aria-hidden="true"
        onLoad={requestSnapshot}
        style={kind === "page" ? { width: "312.5%", height: "550px", transform: "scale(.32)", transformOrigin: "top left" } : undefined}
        className={cn("pointer-events-none absolute left-0 top-0 border-0 bg-white", kind !== "page" && "h-full w-full opacity-20")}
      />
      {kind !== "page" && snapshot && snapshot !== "missing" ? <iframe title={`Live appearance of ${name ?? targetId ?? "item"}`} sandbox="" className="pointer-events-none absolute inset-0 h-full w-full border-0 bg-white" srcDoc={snapshotDocument(snapshot)} /> : null}
      {kind !== "page" && snapshot === "missing" ? <div className="absolute inset-0 grid place-items-center bg-[#070c10] px-5 text-center text-[10px] leading-relaxed text-white/35">This saved item is not rendered on its assigned page yet.</div> : null}
      {kind !== "page" && snapshot === null ? <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_70%_20%,rgba(52,211,153,.12),transparent_45%)]" /> : null}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />
    </div>
  );
}

export function LiveResourcePreview({ appearance, className = "h-48" }: { appearance: PlaygroundAppearance; className?: string }) {
  return <LiveRuntimePreview kind="resource" targetId={appearance.ref} name={appearance.name} route={appearance.usage?.pagePath} className={className} />;
}
