"""UIMP-01 Phase E — repeatable visual parity check for a build-based import.

Compares the project running on its OWN toolchain (the reference URL, e.g.
`vite dev` in the project folder) with the Unison source runtime: the same
document the builder boots, inside the same sandboxed /import-runtime.html
frame. Same engine, viewport, DPR, reduced motion, fonts and scroll positions;
no masks.

  python3 scripts/import-parity/source-build-parity.py <projectDir> <referenceUrl> <unisonUrl> <routes,comma> [pointerOrigin] [outDir]

Set PARITY_BUILD=browser to build inside the running Unison app (needed for
Vue, Svelte, Solid, Sass and Less projects).

`pointerOrigin` is where hosted image pointers (*.asset.json) are served; the
reference fetches the same bytes from it through request routing.
"""
import asyncio, base64, json, os, subprocess, sys
from pathlib import Path
from PIL import Image, ImageChops
from playwright.async_api import async_playwright

PROJECT = Path(sys.argv[1]).resolve()
REF = sys.argv[2].rstrip("/")
UNISON = sys.argv[3].rstrip("/")
ROUTES = sys.argv[4].split(",")
POINTER = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] else ""
OUT = Path(sys.argv[6] if len(sys.argv) > 6 else "/tmp/import-parity-source").resolve()
OUT.mkdir(parents=True, exist_ok=True)
VIEWPORTS = [(1440, 900), (768, 1024), (390, 844)]
SCROLLS = [0, 1200]
NOISE = 8
DETERMINISM = "(() => { let s = 0x2545f491; Math.random = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; })();"
SETTLE_MS = 2500
# Before every capture, on both sides (disclosed): infinite animations are pinned
# to t=0 and finite ones (transitions, entrances) jump to their end state.
FREEZE = "() => { for (const a of document.getAnimations()) { const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null; if (!t || t.iterations === Infinity || t.endTime === Infinity) { a.pause(); a.currentTime = 0; } else { try { a.finish(); } catch (_) { a.pause(); } } } }"
root = Path(__file__).resolve().parents[2]
doc_path = OUT / "runtime-document.json"
# PARITY_BUILD=browser builds inside the Unison app exactly as the builder does
# (esbuild-wasm, Tailwind 4 and the sealed component-compiler frame); the
# default builds with native esbuild through render-source-preview.ts.
BROWSER_BUILD = os.environ.get("PARITY_BUILD") == "browser"
SKIP_DIRS = {"node_modules", ".git", "dist", ".next", ".output", ".vinxi", ".wrangler", ".tanstack", ".svelte-kit", "build", "out"}
BROWSER_DOC = r"""async ([entries, assetBase, pointer]) => {
  const { intakeLooseFiles } = await import('/src/services/import/secureIntake.ts');
  const { analyzeImportedProject } = await import('/src/services/import/importCompatibilityProfile.ts');
  const { planSourceBuild } = await import('/src/services/import/sourceBuild/sourceBuildPlan.ts');
  const { buildImportedSourceInBrowser } = await import('/src/services/import/sourceBuild/browserSourceBuild.ts');
  const decode = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const intake = await intakeLooseFiles(entries.map(([path, b64]) => ({ path, bytes: decode(b64) })), { name: 'fixture' });
  const profile = analyzeImportedProject({ manifest: intake.manifest, textFiles: intake.textFiles });
  const files = Object.fromEntries(Object.entries(intake.textFiles).map(([p, t]) => ['/' + p, t]));
  const plan = planSourceBuild(profile, files);
  if (plan.status !== 'supported') return { ok: false, plan };
  const assetUrls = {};
  const publicDir = (plan.root ? plan.root.slice(1) + '/' : '') + 'public/';
  for (const [p, bytes] of Object.entries(intake.binaryFiles)) {
    if (p.startsWith(publicDir)) { assetUrls['/' + p] = assetBase.replace(/\/$/, '') + '/' + p.slice(publicDir.length).split('/').map(encodeURIComponent).join('/'); continue; }
    assetUrls['/' + p] = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); const ext = p.split('.').pop().toLowerCase(); fr.readAsDataURL(new Blob([bytes], { type: ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp', ico: 'image/x-icon', gif: 'image/gif', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf' })[ext] || 'application/octet-stream' })); });
  }
  const result = await buildImportedSourceInBrowser({ plan, files, assetUrls, pointerOrigin: pointer || null });
  return { ...result, plan: { kind: plan.kind, entry: plan.entry, stack: plan.stack }, framework: profile.framework };
}"""

async def browser_document():
    entries = []
    for path in sorted(PROJECT.rglob("*")):
        rel = path.relative_to(PROJECT)
        if any(part in SKIP_DIRS for part in rel.parts) or not path.is_file():
            continue
        entries.append([str(rel).replace("\\", "/"), base64.b64encode(path.read_bytes()).decode()])
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(f"{UNISON}/robots.txt")
        doc = await page.evaluate(BROWSER_DOC, [entries, REF, POINTER])
        await browser.close()
    return doc

if BROWSER_BUILD:
    DOC = asyncio.run(browser_document())
    if not DOC.get("ok"):
        print(json.dumps({k: DOC.get(k) for k in ("plan", "diagnostics")}, indent=1)[:4000]); sys.exit(1)
    doc_path.write_text(json.dumps(DOC))
else:
    args = ["bun", str(root / "scripts/import-parity/render-source-preview.ts"), str(PROJECT), REF, str(doc_path)] + ([POINTER] if POINTER else [])
    build_log = subprocess.run(args, cwd=root, capture_output=True, text=True)
    if build_log.returncode != 0:
        print(build_log.stdout, build_log.stderr); sys.exit(1)
    DOC = json.loads(doc_path.read_text())

GEOMETRY = """() => Array.from(document.querySelectorAll('body *')).filter(e => !['SCRIPT','STYLE','LINK'].includes(e.tagName)).map(e => {
  const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
  return [e.tagName, Math.round(r.x*2)/2, Math.round(r.y*2)/2, Math.round(r.width*2)/2, Math.round(r.height*2)/2, s.fontFamily, s.fontSize, s.color];
})"""
HOST = """([doc, path, w, h]) => new Promise((resolve) => {
  document.documentElement.innerHTML = '<head><style>html,body{margin:0;overflow:hidden}</style></head><body></body>';
  const f = document.createElement('iframe');
  f.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups allow-modals');
  f.style.cssText = `border:0;display:block;width:${w}px;height:${h}px`;
  window.addEventListener('message', (e) => {
    if (e.source !== f.contentWindow) return;
    if (e.data.type === 'unison-source-runtime:ready') f.contentWindow.postMessage({ type: 'unison-source-runtime:boot', document: doc.document, publicUrls: doc.publicUrls, initialPath: path, nonce: 'parity' }, '*');
    if (e.data.type === 'unison-source-runtime:loaded') resolve(true);
  });
  f.src = '/import-runtime.html';
  document.body.appendChild(f);
})"""

GEOMETRY_TOLERANCE = 0.5  # px; boxes are measured at half-pixel precision (disclosed)

def same_box(a, b):
    return len(a) == len(b) and all(abs(x - y) <= GEOMETRY_TOLERANCE if isinstance(x, (int, float)) and isinstance(y, (int, float)) else x == y for x, y in zip(a, b))

async def settle(frame):
    await frame.evaluate("document.fonts ? document.fonts.ready.then(() => true) : true")
    await frame.evaluate("Promise.all(Array.from(document.images).map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 8000); })))")

def compare(a, b, name):
    ia, ib = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    if ia.size != ib.size:
        return {"pixels": ia.width * ia.height, "differing": -1, "materialDiffering": -1, "materialPct": 100.0, "sizeMismatch": [ia.size, ib.size]}
    diff = ImageChops.difference(ia, ib)
    px = list(diff.getdata()); total = ia.width * ia.height
    exact = sum(1 for p in px if p != (0, 0, 0))
    material = sum(1 for p in px if max(p) > NOISE)
    if exact:
        diff.point(lambda v: 255 if v > NOISE else (80 if v else 0)).save(OUT / f"diff_{name}.png")
    return {"pixels": total, "differing": exact, "materialDiffering": material, "materialPct": round(material * 100 / total, 4)}

async def route_pointer(ctx):
    if not POINTER: return
    async def handler(route):
        url = route.request.url
        path = url[url.index("/__l5e/"):]
        resp = await route.fetch(url=POINTER.rstrip("/") + path)
        await route.fulfill(response=resp)
    await ctx.route(f"{REF}/__l5e/**", handler)

async def main():
    report = {"project": str(PROJECT), "reference": REF, "framework": DOC.get("framework"), "build": {"ok": DOC["ok"], "diagnostics": DOC["diagnostics"], "adaptations": DOC["adaptations"]},
              "noiseThreshold": NOISE, "geometryTolerancePx": 0.5, "masks": [], "determinism": ["seeded Math.random on both sides", "prefers-reduced-motion on both sides", "infinite animations paused at t=0 and finite transitions finished on both sides", f"{SETTLE_MS} ms settle"],
              "pointerOrigin": POINTER or None, "cases": []}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for route in ROUTES:
            for (w, h) in VIEWPORTS:
                ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, reduced_motion="reduce")
                await ctx.add_init_script(DETERMINISM)
                await route_pointer(ctx)
                ref = await ctx.new_page(); await ref.goto(f"{REF}{route}", wait_until="networkidle")
                pre = await ctx.new_page()
                errors = []
                pre.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
                await pre.goto(f"{UNISON}/robots.txt")
                await pre.evaluate(HOST, [DOC, route, w, h])
                await pre.wait_for_load_state("networkidle")
                frame = next(f for f in pre.frames if f != pre.main_frame)
                await settle(ref.main_frame); await settle(frame); await ref.wait_for_timeout(SETTLE_MS)
                await ref.evaluate(FREEZE); await frame.evaluate(FREEZE); await ref.wait_for_timeout(400)
                geo_ref, geo_pre = await ref.evaluate(GEOMETRY), await frame.evaluate(GEOMETRY)
                geo_pairs = [[x, y] for x, y in zip(geo_ref, geo_pre) if not same_box(x, y)]
                geo_mismatch = len(geo_pairs) + abs(len(geo_ref) - len(geo_pre))
                for y in SCROLLS:
                    await ref.evaluate(f"window.scrollTo(0,{y})"); await frame.evaluate(f"window.scrollTo(0,{y})")
                    await ref.wait_for_timeout(300)
                    await ref.evaluate(FREEZE); await frame.evaluate(FREEZE); await ref.wait_for_timeout(400)
                    slug = route.strip("/").replace("/", "_") or "home"
                    name = f"{slug}_{w}x{h}_y{y}"
                    a, b = OUT / f"original_{name}.png", OUT / f"preview_{name}.png"
                    await ref.screenshot(path=str(a)); await pre.screenshot(path=str(b))
                    report["cases"].append({"route": route, "viewport": [w, h], "scrollY": y, "elements": [len(geo_ref), len(geo_pre)], "geometryMismatches": geo_mismatch, "geometryDiffs": geo_pairs[:5], "runtimeErrors": errors[:5], **compare(a, b, name)})
                await ctx.close()
        await browser.close()
    report["visualParity"] = "verified" if all(c["materialDiffering"] == 0 and c["geometryMismatches"] == 0 for c in report["cases"]) else "failed"
    (OUT / "report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k != "build"}, indent=1))

asyncio.run(main())
