#!/usr/bin/env node
/**
 * 21st Intake harness — development-time only.
 *
 * Pulls REAL component source from the 21st.dev catalog through the official
 * CLI, runs Unison's dependency allowlist over the declared dependency set,
 * and writes the result into `src/design/21st-intake/imported/<slug>/` as
 * quarantine. Nothing here registers a component: promotion into
 * VARIANT_REGISTRY stays a deliberate, reviewed step.
 *
 * Usage:
 *   node scripts/21st-intake.mjs search "product grid"
 *   node scripts/21st-intake.mjs quarantine <id> <slug>
 *   node scripts/21st-intake.mjs report
 *
 * Requires TWENTYFIRST_TOKEN in the environment.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const IMPORTED_DIR = path.resolve('src/design/21st-intake/imported');

/** Mirrors src/design/21st-intake/dependencyResolver.ts — kept in sync by hand. */
const BASELINE = new Set([
  'react', 'react-dom', 'tailwindcss', 'framer-motion', 'lucide-react',
  'embla-carousel-react', 'class-variance-authority', 'clsx', 'tailwind-merge',
]);
const ALLOWED_SCOPES = ['@radix-ui/'];
const REJECTED = new Set([
  'next', 'server-only', 'gsap', 'react-spring', '@react-spring/web', 'animejs',
  'swiper', 'keen-slider', 'react-slick', 'slick-carousel', 'react-icons',
  '@heroicons/react', 'bootstrap', 'bulma', 'headlessui', '@headlessui/react',
  '@mui/material', 'antd',
]);
/** 3D runtime: allowed only through the explicit 3D capability gate, then adapted onto @/unison/ui/experience. */
const CAPABILITY_GATED = new Set(['three', '@react-three/fiber', '@react-three/drei']);
const GATE_3D = process.argv.includes('--capability=threeD');

function rootName(dep) {
  return dep.startsWith('@') ? dep.split('/').slice(0, 2).join('/') : dep.split('/')[0];
}

function classify(dep) {
  const root = rootName(dep);
  if (REJECTED.has(root)) return { dep, verdict: 'rejected', reason: 'Disallowed runtime or duplicate subsystem' };
  if (ALLOWED_SCOPES.some((s) => dep.startsWith(s))) return { dep, verdict: 'allowed', reason: 'Approved behavior primitive scope' };
  if (BASELINE.has(root)) return { dep, verdict: 'allowed', reason: 'Baseline stack' };
  if (CAPABILITY_GATED.has(root)) {
    return GATE_3D
      ? { dep, verdict: 'capability-gated', reason: 'Permitted by explicit 3D capability gate; must adapt onto @/unison/ui/experience' }
      : { dep, verdict: 'rejected', reason: 'Requires --capability=threeD' };
  }
  return { dep, verdict: 'unknown', reason: 'Not on the allowlist — requires manual review' };
}

function cli(args) {
  if (!process.env.TWENTYFIRST_TOKEN) {
    throw new Error('TWENTYFIRST_TOKEN is not set — cannot reach the 21st catalog.');
  }
  return execFileSync('npx', ['-y', '@21st-dev/cli@latest', ...args], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

/** Local imports a shadcn-style source expects (`@/components/ui/x`). */
function collectImports(source) {
  const external = new Set();
  const registry = new Set();
  const re = /from\s+["']([^"']+)["']/g;
  let match;
  while ((match = re.exec(source))) {
    const spec = match[1];
    if (spec.startsWith('@/components/ui/')) registry.add(spec.replace('@/components/ui/', ''));
    else if (spec.startsWith('.') || spec.startsWith('@/')) continue;
    else external.add(rootName(spec));
  }
  return { external: [...external].sort(), registry: [...registry].sort() };
}

function detectCapabilities(source) {
  return {
    motion: /framer-motion|animate|transition/i.test(source),
    threeD: /@react-three|three\b/.test(source),
    media: /<img|<video|backgroundImage/i.test(source),
    forms: /<form|<input|<textarea/i.test(source),
    carousel: /carousel|embla|marquee|slider/i.test(source),
  };
}

function detectCompatibility(source) {
  return {
    react19: !/componentWillMount|findDOMNode/.test(source),
    tailwind3: !/@theme\s|theme\(--/.test(source),
    vite: !/from\s+["']next\//.test(source),
    clientOnly: /"use client"|'use client'/.test(source),
  };
}

function search(query, limit = 8) {
  const raw = cli(['search', query, '--type', 'c', '--limit', String(limit), '--json']);
  const items = JSON.parse(raw);
  for (const item of items) {
    console.log(`${String(item.id).padStart(6)}  ${item.name.slice(0, 44).padEnd(46)} @${item.author}`);
  }
}

function quarantine(id, slug) {
  const payload = JSON.parse(cli(['get', String(id), '--json']));
  const component = payload.component ?? payload;
  const source = component.componentCode ?? '';
  if (!source.trim()) throw new Error(`Component ${id} returned no source code.`);

  const { external, registry } = collectImports(source);
  const decisions = external.map(classify);
  const rejected = decisions.filter((d) => d.verdict === 'rejected');
  const unknown = decisions.filter((d) => d.verdict === 'unknown');

  const dir = path.join(IMPORTED_DIR, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'source.tsx'), source, 'utf8');
  if (component.demoCode) fs.writeFileSync(path.join(dir, 'demo.tsx.txt'), component.demoCode, 'utf8');

  const record = {
    sourceId: `21st:${component.id}`,
    name: component.name,
    author: component.author ?? component.authorUsername,
    sourceUrl: component.url ?? `https://21st.dev/c/${component.id}`,
    sourceType: 'component',
    dependencies: external,
    registryDependencies: registry,
    license: component.license ?? undefined,
    licenseReview: { status: 'unverified' },
    attribution: `21st.dev — ${component.name} by @${component.author ?? 'unknown'}`,
    designTags: [],
    capabilities: detectCapabilities(source),
    compatibility: detectCompatibility(source),
    adaptation: {
      tokensNormalized: false,
      importsNormalized: false,
      reducedMotionSupported: false,
      responsiveVerified: false,
      canonicalSlotsAdded: false,
      intentReady: false,
      portableRecipeCertified: false,
    },
    step: 3,
    dependencyAudit: { decisions, approved: rejected.length === 0 && unknown.length === 0 },
  };
  fs.writeFileSync(path.join(dir, 'record.json'), `${JSON.stringify(record, null, 2)}\n`, 'utf8');

  console.log(`quarantined ${slug} <- 21st:${component.id} (${component.name})`);
  console.log(`  external deps    : ${external.join(', ') || '(none)'}`);
  console.log(`  registry deps    : ${registry.join(', ') || '(none)'}`);
  if (rejected.length) console.log(`  REJECTED         : ${rejected.map((d) => d.dep).join(', ')}`);
  if (unknown.length) console.log(`  NEEDS REVIEW     : ${unknown.map((d) => d.dep).join(', ')}`);
  console.log('  promotion allowed: NO ? license review and canonical certification required');
}

function report() {
  if (!fs.existsSync(IMPORTED_DIR)) return console.log('no quarantine directory');
  const slugs = fs.readdirSync(IMPORTED_DIR).filter((entry) => {
    return fs.statSync(path.join(IMPORTED_DIR, entry)).isDirectory();
  });
  if (!slugs.length) return console.log('quarantine is empty');
  for (const slug of slugs) {
    const file = path.join(IMPORTED_DIR, slug, 'record.json');
    if (!fs.existsSync(file)) continue;
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    const state = record.implementationId
      ? `promoted -> ${record.implementationId}`
      : record.dependencyAudit?.approved
        ? 'dependency audit passed; license review and canonical certification required'
        : 'blocked on dependencies';
    console.log(`${slug.padEnd(30)} ${record.sourceId.padEnd(12)} ${state}`);
  }
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (command === 'search') search(rest.join(' ') || 'hero');
  else if (command === 'quarantine') quarantine(rest[0], rest[1] ?? `component-${rest[0]}`);
  else if (command === 'report') report();
  else {
    console.log('usage: 21st-intake.mjs search <query> | quarantine <id> <slug> | report');
    process.exit(1);
  }
} catch (error) {
  console.error(String(error.message ?? error));
  process.exit(1);
}
