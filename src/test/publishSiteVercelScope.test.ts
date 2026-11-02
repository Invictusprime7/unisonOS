// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeCanonicalVfsHash } from "../../supabase/functions/_shared/canonicalPublishRevision.ts";

const { adminClient } = vi.hoisted(() => ({
  adminClient: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

vi.mock("../../supabase/functions/_shared/auth.ts", () => ({
  getServiceRoleClient: () => adminClient,
  verifyAuth: vi.fn(async () => ({ user: { id: "test-user" } })),
  authError: vi.fn(),
}));
vi.mock("../../supabase/functions/_shared/cors.ts", () => ({
  getCorsHeaders: () => ({}),
  handleCorsPreflightRequest: () => null,
}));
vi.mock("../../supabase/functions/_shared/publishAttestation.ts", () => ({
  verifyPublishAttestation: vi.fn(),
}));
vi.mock("../../supabase/functions/_shared/canonicalPublishRevision.ts", async (importOriginal) => ({
  ...await importOriginal(),
  verifyCanonicalPublishSource: vi.fn(async () => ({ ok: true })),
}));

describe("Vercel publisher credential scope", () => {
  let handler: (request: Request) => Promise<Response>;
  let env: Record<string, string>;
  const fetchMock = vi.fn();
  const projectId = "11111111-1111-4111-8111-111111111111";
  const revision = {
    id: "22222222-2222-4222-8222-222222222222",
    project_id: projectId,
    status: "committed",
    publish_ready: true,
    vfs_hash: "",
    vfs_files: { "index.html": "<html><body>Powered by Unison</body></html>" },
  };

  beforeEach(async () => {
    vi.resetModules();
    fetchMock.mockReset();
    env = { VERCEL_TOKEN: "test-deployment-token", SUPABASE_URL: "https://project.supabase.co" };
    revision.vfs_hash = await computeCanonicalVfsHash(revision.vfs_files);
    let revisionQueryCount = 0;
    adminClient.rpc.mockResolvedValue({ data: true, error: null });
    adminClient.from.mockImplementation(() => {
      const currentQuery = ++revisionQueryCount;
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
        maybeSingle: vi.fn(async () => ({
          data: currentQuery === 1 ? { id: revision.id } : revision,
          error: null,
        })),
      };
      return query;
    });
    vi.stubGlobal("Deno", {
      env: { get: (name: string) => env[name] },
      serve: (callback: typeof handler) => { handler = callback; },
    });
    vi.stubGlobal("fetch", fetchMock);
    // Load the Deno entrypoint at runtime without adding its remote imports
    // to the browser application's TypeScript compilation.
    const edgeEntrypoint = "../../supabase/functions/publish-site/index.ts";
    await import(edgeEntrypoint);
  });

  afterEach(() => vi.unstubAllGlobals());

  function publish() {
    return handler(new Request("https://example.test/publish-site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "vercel",
        siteName: "customer-site",
        projectId,
        canonicalRevision: { projectId, revisionId: revision.id, vfsHash: revision.vfs_hash },
        files: revision.vfs_files,
      }),
    }));
  }

  it.each([undefined, "team_example"])("uses the same scope for preflight and deployment: %s", async (teamId) => {
    if (teamId) env.VERCEL_TEAM_ID = teamId;
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ url: "customer-site.vercel.app" }), { status: 200 }));
    const response = await publish();
    expect(response.status).toBe(200);
    const preflightUrl = new URL(fetchMock.mock.calls[0][0]);
    const deploymentUrl = new URL(fetchMock.mock.calls[1][0]);
    expect(preflightUrl.pathname).toBe("/v6/deployments");
    expect(preflightUrl.searchParams.get("limit")).toBe("1");
    expect(deploymentUrl.pathname).toBe("/v13/deployments");
    expect(preflightUrl.searchParams.get("teamId")).toBe(teamId ?? null);
    expect(deploymentUrl.searchParams.get("teamId")).toBe(teamId ?? null);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).name).toBe("customer-site");
  });

  it("refuses deployment when the scoped credential check fails", async () => {
    env.VERCEL_TEAM_ID = "team_example";
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 403 }));
    expect((await publish()).status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
