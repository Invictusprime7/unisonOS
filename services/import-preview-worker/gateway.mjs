import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { ECSClient, DescribeTasksCommand, RunTaskCommand, StopTaskCommand } from '@aws-sdk/client-ecs';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createContextClient, verifyAuth } from '@supabase/server/core';
import { validateImportedPreviewRequest } from './contract.mjs';

const PORT = Number(process.env.PORT || 3001);
const PREVIEW_PORT = 4173;
const SESSION_TTL_SECONDS = 30 * 60;
const MAX_ACTIVE_PER_USER = 2;
const BODY_LIMIT = 4 * 1024 * 1024;
const SESSION_ID = /^[a-f0-9]{32}$/;
const MAX_ACTIVE_GLOBAL = 10;
const sessions = new Map();
const ecs = new ECSClient({ region: process.env.AWS_REGION });
const s3 = new S3Client({ region: process.env.AWS_REGION });

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function isAllowedApiOrigin(origin) {
  if (!origin) return false;
  const appOrigin = new URL(process.env.APP_ORIGIN || 'https://www.unisontasks.com').origin;
  if (origin === appOrigin) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
}

function applyApiCors(req, res) {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && isAllowedApiOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return true;
  }
  return false;
}

function requestForAuth(req) {
  const headers = new Headers();
  if (typeof req.headers.authorization === 'string') headers.set('authorization', req.headers.authorization);
  const host = typeof req.headers.host === 'string' ? req.headers.host : 'gateway.invalid';
  return new Request(`https://${host}${req.url || '/'}`, { method: 'GET', headers });
}

async function authenticate(req) {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) throw new HttpError(503, 'Preview authorization is not configured.');
  const issuer = `${new URL(supabaseUrl).origin}/auth/v1`;
  const { data: auth, error } = await verifyAuth(requestForAuth(req), { auth: 'user', issuer });
  if (error || !auth?.userClaims?.id) throw new HttpError(error?.status || 401, 'Sign in to start an imported preview.');
  return auth;
}

async function assertProjectAccess(auth, projectId) {
  const client = createContextClient({ auth: { token: auth.token, keyName: auth.keyName } });
  const { data, error } = await client.from('projects').select('id').eq('id', projectId).maybeSingle();
  if (error || !data) throw new HttpError(404, 'Project not found or access denied.');
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new HttpError(413, 'Imported preview request exceeds the worker limit.');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, 'Invalid JSON request.'); }
}

function splitList(value) {
  return String(value || '').split(',').map((part) => part.trim()).filter(Boolean);
}

function probeWorker(ip) {
  return new Promise((resolve) => {
    const request = http.request({
      host: ip,
      port: PREVIEW_PORT,
      method: 'GET',
      path: '/',
      headers: { host: `localhost:${PREVIEW_PORT}` },
      timeout: 1_500,
    }, (response) => {
      response.resume();
      resolve((response.statusCode || 500) < 500 && response.statusCode !== 403);
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => resolve(false));
    request.end();
  });
}

function requireWorkerConfig() {
  const required = ['PREVIEW_BASE_DOMAIN', 'PREVIEW_SOURCE_BUCKET', 'ECS_CLUSTER', 'WORKER_TASK_DEFINITION', 'WORKER_SUBNETS', 'WORKER_SECURITY_GROUP'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) throw new HttpError(503, `Preview worker is not configured: ${missing.join(', ')}.`);
}

function sessionUrl(id) {
  const baseDomain = process.env.PREVIEW_BASE_DOMAIN.replace(/^\*\./, '').replace(/^\./, '');
  return `https://${id}.${baseDomain}/`;
}

async function launchTask(session, validated, sourceUrl) {
  try {
    const result = await ecs.send(new RunTaskCommand({
      cluster: process.env.ECS_CLUSTER,
      taskDefinition: process.env.WORKER_TASK_DEFINITION,
      launchType: 'FARGATE',
      count: 1,
      startedBy: session.id,
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: splitList(process.env.WORKER_SUBNETS),
          securityGroups: [process.env.WORKER_SECURITY_GROUP],
          assignPublicIp: 'ENABLED',
        },
      },
      overrides: {
        containerOverrides: [{
          name: process.env.WORKER_CONTAINER_NAME || 'import-preview-worker',
          environment: [
            { name: 'PREVIEW_SESSION_ID', value: session.id },
            { name: 'PREVIEW_SOURCE_URL', value: sourceUrl },
            { name: 'PREVIEW_START_SCRIPT', value: validated.importedRuntime.startScript },
            { name: 'PREVIEW_PACKAGE_MANAGER', value: validated.importedRuntime.packageManager },
            { name: 'PREVIEW_FRAMEWORK', value: validated.importedRuntime.framework },
            { name: 'PREVIEW_SUPABASE_STORAGE_HOST', value: new URL(process.env.SUPABASE_URL).hostname },
            { name: 'PREVIEW_TTL_SECONDS', value: String(SESSION_TTL_SECONDS) },
          ],
        }],
      },
    }));

    const task = result.tasks?.[0];
    if (!task?.taskArn || result.failures?.length) throw new Error('ECS did not start a preview task.');
    session.taskArn = task.taskArn;

    for (let attempt = 0; attempt < 600; attempt += 1) {
      if (session.status === 'stopped') return;
      const described = await ecs.send(new DescribeTasksCommand({ cluster: process.env.ECS_CLUSTER, tasks: [task.taskArn] }));
      const current = described.tasks?.[0];
      if (!current) throw new Error('Preview task disappeared during startup.');
      if (current.lastStatus === 'STOPPED') throw new Error(current.stoppedReason || 'Preview task stopped before the app was ready.');

      const privateIp = current.attachments?.flatMap((attachment) => attachment.details || [])
        .find((detail) => detail.name === 'privateIPv4Address')?.value;
      if (current.lastStatus === 'RUNNING' && privateIp) {
        session.privateIp = privateIp;
        if (await probeWorker(privateIp)) {
          session.status = 'running';
          return;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    throw new Error('Preview task did not become ready in time.');
  } catch (error) {
    session.status = 'error';
    session.error = error instanceof Error ? error.message : 'Preview task failed.';
    if (session.taskArn) {
      await ecs.send(new StopTaskCommand({ cluster: process.env.ECS_CLUSTER, task: session.taskArn, reason: 'Preview failed to start' })).catch(() => undefined);
    }
    console.error('[import-preview-worker] task startup failed', { sessionId: session.id, error: session.error });
  }
}

async function startSession(req, res) {
  requireWorkerConfig();
  const auth = await authenticate(req);
  const body = await readJson(req);
  const validated = validateImportedPreviewRequest(body, { supabaseUrl: process.env.SUPABASE_URL });
  await assertProjectAccess(auth, validated.projectId);

  const active = [...sessions.values()].filter((session) => session.ownerId === auth.userClaims.id && session.status !== 'stopped' && session.expiresAt > Date.now()).length;
  if (active >= MAX_ACTIVE_PER_USER) throw new HttpError(429, `At most ${MAX_ACTIVE_PER_USER} imported previews can run at once.`);
  const globalActive = [...sessions.values()].filter((session) => session.status !== 'stopped' && session.expiresAt > Date.now()).length;
  if (globalActive >= MAX_ACTIVE_GLOBAL) throw new HttpError(503, 'Imported preview capacity is temporarily full.');

  const id = randomBytes(16).toString('hex');
  const sourceKey = `source/${id}.json`;
  const session = {
    id,
    ownerId: auth.userClaims.id,
    projectId: validated.projectId,
    status: 'starting',
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
    sourceKey,
    taskArn: null,
    privateIp: null,
    error: null,
  };
  sessions.set(id, session);
  try {
    await s3.send(new PutObjectCommand({
      Bucket: process.env.PREVIEW_SOURCE_BUCKET,
      Key: sourceKey,
      Body: JSON.stringify(validated),
      ContentType: 'application/json',
      ServerSideEncryption: 'AES256',
    }));
    const sourceUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: process.env.PREVIEW_SOURCE_BUCKET, Key: sourceKey }), { expiresIn: 900 });
    void launchTask(session, validated, sourceUrl);
  } catch (error) {
    sessions.delete(id);
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.PREVIEW_SOURCE_BUCKET, Key: sourceKey })).catch(() => undefined);
    throw error;
  }

  sendJson(res, 202, { success: true, session: { id, iframeUrl: sessionUrl(id), status: 'starting' } });
}

async function ownedSession(req, id) {
  const auth = await authenticate(req);
  const session = sessions.get(id);
  if (!session || session.ownerId !== auth.userClaims.id) throw new HttpError(404, 'Preview session not found.');
  return { auth, session };
}

async function stopSession(req, res, id) {
  const { session } = await ownedSession(req, id);
  session.status = 'stopped';
  if (session.taskArn) await ecs.send(new StopTaskCommand({ cluster: process.env.ECS_CLUSTER, task: session.taskArn, reason: 'Preview closed by owner' })).catch(() => undefined);
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.PREVIEW_SOURCE_BUCKET, Key: session.sourceKey })).catch(() => undefined);
  sessions.delete(id);
  sendJson(res, 200, { success: true });
}

async function pingSession(req, res, id) {
  const { session } = await ownedSession(req, id);
  if (session.expiresAt <= Date.now()) throw new HttpError(410, 'Preview session expired.');
  session.lastActivityAt = Date.now();
  sendJson(res, 200, { success: true, status: session.status });
}

async function previewApi(req, res, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 3 && parts[2] === 'start' && req.method === 'POST') return startSession(req, res);
  if (parts.length === 4 && SESSION_ID.test(parts[2])) {
    if (parts[3] === 'stop' && req.method === 'POST') return stopSession(req, res, parts[2]);
    if (parts[3] === 'ping' && req.method === 'POST') return pingSession(req, res, parts[2]);
    if (parts[3] === 'logs' && req.method === 'GET') {
      await ownedSession(req, parts[2]);
      return sendJson(res, 200, { logs: [], hasMore: false });
    }
  }
  throw new HttpError(404, 'Unknown preview route.');
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function waitPage(session) {
  const message = session.status === 'error' ? escapeHtml(session.error || 'Preview failed to start.') : 'Starting the original project in an isolated runtime…';
  const retry = session.status === 'error' ? '' : '<script>setInterval(async()=>{try{const s=await fetch("/__preview/status").then(r=>r.json());if(s.status==="running")location.reload();if(s.status==="error"){document.querySelector("p").textContent=s.error||"Preview failed."}},2000)</script>';
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Imported preview</title><main><h1>Imported project preview</h1><p>${message}</p></main>${retry}<style>body{font:14px system-ui;margin:0;background:#101116;color:#f5f5f5;display:grid;min-height:100vh;place-items:center}main{max-width:34rem;padding:2rem;text-align:center}p{color:#aaa;line-height:1.6}</style>`;
}

function sendWaitPage(res, session) {
  const body = waitPage(session);
  const appOrigin = new URL(process.env.APP_ORIGIN || 'https://www.unisontasks.com').origin;
  res.writeHead(session.status === 'error' ? 502 : 200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors ${appOrigin}`,
    'Referrer-Policy': 'no-referrer',
  });
  res.end(body);
}

function proxyHeaders(req, host) {
  const headers = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (['authorization', 'cookie', 'host', 'proxy-authorization', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto'].includes(name)) continue;
    if (typeof value === 'string' || Array.isArray(value)) headers[name] = value;
  }
  headers.host = `localhost:${PREVIEW_PORT}`;
  headers['x-forwarded-host'] = host;
  headers['x-forwarded-proto'] = 'https';
  return headers;
}

function rewriteResponseHeaders(headers) {
  const rewritten = { ...headers };
  delete rewritten['x-frame-options'];
  if (rewritten['set-cookie']) {
    const cookies = Array.isArray(rewritten['set-cookie']) ? rewritten['set-cookie'] : [rewritten['set-cookie']];
    rewritten['set-cookie'] = cookies.map((cookie) => String(cookie).replace(/;\s*Domain=[^;]*/ig, ''));
  }
  const appOrigin = new URL(process.env.APP_ORIGIN || 'https://www.unisontasks.com').origin;
  const csp = rewritten['content-security-policy'];
  if (typeof csp === 'string') {
    rewritten['content-security-policy'] = `${csp.split(';').filter((part) => !/^\s*frame-ancestors\b/i.test(part)).join(';')}; frame-ancestors ${appOrigin}`;
  } else rewritten['content-security-policy'] = `frame-ancestors ${appOrigin}`;
  rewritten['referrer-policy'] = 'no-referrer';
  rewritten['x-content-type-options'] = 'nosniff';
  rewritten['permissions-policy'] = 'camera=(), microphone=(), geolocation=()';
  rewritten['access-control-allow-origin'] = '*';
  rewritten['access-control-allow-methods'] = 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS';
  rewritten['access-control-allow-headers'] = '*';
  return rewritten;
}

function proxyHttp(req, res, session, url) {
  const upstream = http.request({
    host: session.privateIp,
    port: PREVIEW_PORT,
    method: req.method,
    path: `${url.pathname}${url.search}`,
    headers: proxyHeaders(req, req.headers.host || ''),
    timeout: 15_000,
  }, (response) => {
    res.writeHead(response.statusCode || 502, rewriteResponseHeaders(response.headers));
    response.pipe(res);
  });
  upstream.on('timeout', () => upstream.destroy(new Error('Preview worker timed out.')));
  upstream.on('error', () => { if (!res.headersSent) sendJson(res, 502, { error: 'Preview worker is unavailable.' }); else res.destroy(); });
  req.pipe(upstream);
}

function proxyWebSocket(req, socket, head, session, url) {
  const upstream = http.request({
    host: session.privateIp,
    port: PREVIEW_PORT,
    method: 'GET',
    path: `${url.pathname}${url.search}`,
    headers: { ...proxyHeaders(req, req.headers.host || ''), connection: 'Upgrade', upgrade: 'websocket' },
  });
  upstream.on('upgrade', (response, upstreamSocket, upstreamHead) => {
    const statusLine = `HTTP/${response.httpVersion} ${response.statusCode} ${response.statusMessage}\r\n`;
    const responseHeaders = [];
    for (let index = 0; index < response.rawHeaders.length; index += 2) {
      responseHeaders.push(`${response.rawHeaders[index]}: ${response.rawHeaders[index + 1]}\r\n`);
    }
    socket.write(`${statusLine}${responseHeaders.join('')}\r\n`);
    if (upstreamHead.length) socket.write(upstreamHead);
    if (head.length) upstreamSocket.write(head);
    upstreamSocket.pipe(socket).pipe(upstreamSocket);
  });
  upstream.on('error', () => socket.destroy());
  upstream.end();
}

function previewRequest(req, res, session, url) {
  if (url.pathname === '/__preview/status') {
    return sendJson(res, 200, { status: session.status, error: session.status === 'error' ? session.error : undefined });
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Vary': 'Origin',
    });
    return res.end();
  }
  if (session.status !== 'running' || !session.privateIp) return sendWaitPage(res, session);
  proxyHttp(req, res, session, url);
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (requestUrl.pathname === '/health' && req.method === 'GET') return sendJson(res, 200, { status: 'ok' });
  if (requestUrl.pathname.startsWith('/api/preview/')) {
    if (applyApiCors(req, res)) return;
    try { await previewApi(req, res, requestUrl.pathname); }
    catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error('[import-preview-worker] gateway request failed', error);
      sendJson(res, status, { success: false, error: error instanceof HttpError ? error.message : 'Preview gateway error.' });
    }
    return;
  }

  const baseDomain = String(process.env.PREVIEW_BASE_DOMAIN || '').replace(/^\*\./, '').toLowerCase();
  const host = String(req.headers.host || '').toLowerCase().split(':')[0];
  const suffix = `.${baseDomain}`;
  const id = baseDomain && host.endsWith(suffix) ? host.slice(0, -suffix.length) : '';
  if (!SESSION_ID.test(id)) return sendJson(res, 404, { error: 'Preview session not found.' });
  const session = sessions.get(id);
  if (!session || session.expiresAt <= Date.now()) return sendJson(res, 404, { error: 'Preview session expired.' });
  previewRequest(req, res, session, requestUrl);
});

server.on('upgrade', (req, socket, head) => {
  const host = String(req.headers.host || '').toLowerCase().split(':')[0];
  const baseDomain = String(process.env.PREVIEW_BASE_DOMAIN || '').replace(/^\*\./, '').toLowerCase();
  const suffix = `.${baseDomain}`;
  const id = baseDomain && host.endsWith(suffix) ? host.slice(0, -suffix.length) : '';
  const session = SESSION_ID.test(id) ? sessions.get(id) : null;
  if (!session || session.status !== 'running' || !session.privateIp) return socket.destroy();
  proxyWebSocket(req, socket, head, session, new URL(req.url || '/', 'https://preview.invalid'));
});

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt > now) continue;
    session.status = 'stopped';
    if (session.taskArn) {
      void ecs.send(new StopTaskCommand({ cluster: process.env.ECS_CLUSTER, task: session.taskArn, reason: 'Preview TTL expired' })).catch(() => undefined);
    }
    void s3.send(new DeleteObjectCommand({ Bucket: process.env.PREVIEW_SOURCE_BUCKET, Key: session.sourceKey })).catch(() => undefined);
    sessions.delete(id);
  }
}, 60_000);
cleanupTimer.unref();

server.listen(PORT, '0.0.0.0', () => console.log(`[import-preview-worker] gateway listening on ${PORT}`));