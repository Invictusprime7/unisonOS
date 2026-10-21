/**
 * GoHighLevel MCP Server
 *
 * Exposes GHL operations as MCP tools so AI agents (in-builder or external)
 * can discover and call GHL workflows / contacts / opportunities without
 * hardcoded knowledge.
 *
 * Transport: Streamable HTTP via mcp-lite + Hono.
 * All GHL calls are proxied through the project-aware `gohighlevel-crm` edge
 * function, which resolves credentials from the project integration registry.
 */

import { Hono } from "npm:hono@4.6.3";
import { McpServer, StreamableHttpTransport } from "npm:mcp-lite@^0.10.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function callCrm(action: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gohighlevel-crm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`gohighlevel-crm[${action}] ${res.status}: ${text}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

const mcp = new McpServer({ name: "unison-ghl", version: "1.0.0" });

mcp.tool("ghl.workflow.list", {
  description: "List GHL automation workflows for a location.",
  inputSchema: {
    type: "object",
      properties: { projectId: { type: "string" }, locationId: { type: "string" } },
    required: ["projectId", "locationId"],
  },
  handler: async ({ projectId, locationId }: { projectId: string; locationId: string }) => {
    const data = await callCrm("getWorkflows", { projectId, locationId });
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});

mcp.tool("ghl.workflow.trigger", {
  description: "Trigger a GHL workflow for a specific contact.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      workflowId: { type: "string" },
      contactId: { type: "string" },
      payload: { type: "object" },
    },
    required: ["projectId", "workflowId", "contactId"],
  },
  handler: async (args: { projectId: string; workflowId: string; contactId: string; payload?: Record<string, unknown> }) => {
    const data = await callCrm("triggerWorkflow", args);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});

mcp.tool("ghl.contact.upsert", {
  description: "Create or update a GHL contact by email or phone.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      locationId: { type: "string" },
      contact: {
        type: "object",
        properties: {
          email: { type: "string" },
          phone: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          name: { type: "string" },
          source: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
    },
    required: ["projectId", "locationId", "contact"],
  },
  handler: async (args: Record<string, unknown>) => {
    const data = await callCrm("upsertContact", args as Record<string, unknown>);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});

mcp.tool("ghl.opportunity.create", {
  description: "Create a sales opportunity in a GHL pipeline.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      locationId: { type: "string" },
      pipelineId: { type: "string" },
      stageId: { type: "string" },
      contactId: { type: "string" },
      opportunity: {
        type: "object",
        properties: {
          name: { type: "string" },
          monetaryValue: { type: "number" },
          status: { type: "string" },
        },
      },
    },
    required: ["projectId", "locationId", "pipelineId", "stageId"],
  },
  handler: async (args: Record<string, unknown>) => {
    const data = await callCrm("createOpportunity", args as Record<string, unknown>);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});

mcp.tool("ghl.contact.tag", {
  description: "Add tags to an existing GHL contact.",
  inputSchema: {
    type: "object",
    properties: {
      projectId: { type: "string" },
      contactId: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["projectId", "contactId", "tags"],
  },
  handler: async (args: Record<string, unknown>) => {
    const data = await callCrm("addContactTag", args as Record<string, unknown>);
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  },
});

const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);
const app = new Hono();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, accept",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

app.options("/*", (c) => new Response("ok", { headers: corsHeaders }));

app.all("/*", async (c) => {
  // Tools act with the project's CRM credentials, so only the service itself
  // (server-to-server) may call them; public callers are refused.
  const bearer = (c.req.header("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!bearer || bearer !== SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const res = await httpHandler(c.req.raw);
  // Re-emit with CORS headers
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
});

Deno.serve(app.fetch);
