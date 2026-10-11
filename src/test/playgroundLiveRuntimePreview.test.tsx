import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LiveRuntimePreview } from "@/components/creatives/web-builder/playground/LiveResourcePreview";

afterEach(() => {
  cleanup();
  document.querySelectorAll("iframe[data-test-builder-runtime]").forEach((frame) => frame.remove());
});

describe("Playground live runtime previews", () => {
  it("discovers a Sandpack runtime even when no revision attribute exists", () => {
    const runtimeHost = document.createElement("div");
    runtimeHost.dataset.unisonPreviewRuntime = "true";
    const builderRuntime = document.createElement("iframe");
    builderRuntime.dataset.testBuilderRuntime = "true";
    builderRuntime.className = "sp-preview-iframe";
    builderRuntime.title = "Sandpack Preview";
    builderRuntime.src = "https://runtime.example.test/preview";
    runtimeHost.appendChild(builderRuntime);
    document.body.appendChild(runtimeHost);

    const { getByTitle } = render(<LiveRuntimePreview kind="page" route="/about" name="About" />);
    const projection = getByTitle("Live page runtime for About") as HTMLIFrameElement;

    expect(projection.src).toBe(builderRuntime.src);
    expect(projection.getAttribute("sandbox")).toContain("allow-scripts");
    expect(projection.getAttribute("sandbox")).toContain("allow-same-origin");
    runtimeHost.remove();
  });
});
