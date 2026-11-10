"""UIMP-01 Phase E — repeatable visual parity check for an imported static site.

Compares the original site (served from its own folder) with the document the
Unison Preview serves inside the same sandboxed frame it uses in the builder.
Same browser engine, viewport, DPR, reduced motion, font readiness and scroll
positions on both sides; no masks.

  python3 scripts/import-parity/static-html-parity.py <siteDir> [entry.html] [outDir]
"""
import asyncio, functools, http.server, json, subprocess, sys, threading
from pathlib import Path
from PIL import Image, ImageChops
from playwright.async_api import async_playwright

SITE = Path(sys.argv[1]).resolve()
ENTRY = sys.argv[2] if len(sys.argv) > 2 else "index.html"
OUT = Path(sys.argv[3] if len(sys.argv) > 3 else "/tmp/import-parity").resolve()
OUT.mkdir(parents=True, exist_ok=True)
VIEWPORTS = [(1440, 900), (768, 1024), (390, 844)]
SCROLLS = [0, 1200]
NOISE = 8  # per-channel difference treated as antialiasing noise (disclosed)
# Determinism control applied identically to both sides (disclosed in the report):
# seeded Math.random so pages that simulate random outcomes render the same state.
DETERMINISM = "(() => { let s = 0x2545f491; Math.random = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; }; })();"
SETTLE_MS = 2000

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(SITE)))
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{server.server_port}"
served = OUT / "served.html"
root = Path(__file__).resolve().parents[2]
info = json.loads(subprocess.check_output(["bun", str(root / "scripts/import-parity/render-static-preview.ts"), str(SITE), ENTRY, BASE, str(served)], cwd=root).decode().strip().splitlines()[-1])
HOST = ("<!doctype html><html><head><style>html,body{margin:0;height:100%;overflow:hidden}"
        "iframe{display:block;border:0;width:100%;height:100%}</style></head><body>"
        "<iframe id=f sandbox=\"allow-scripts allow-forms allow-popups allow-modals\"></iframe></body></html>")

GEOMETRY = """() => Array.from(document.querySelectorAll('body *')).filter(e => !e.hasAttribute('data-unison-import-overlay')).map(e => {
  const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
  return [e.tagName, Math.round(r.x*2)/2, Math.round(r.y*2)/2, Math.round(r.width*2)/2, Math.round(r.height*2)/2, s.fontFamily, s.fontSize, s.color];
})"""

async def settle(frame):
    await frame.evaluate("document.fonts ? document.fonts.ready.then(() => true) : true")
    await frame.evaluate("Promise.all(Array.from(document.images).map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; })))")

def compare(a, b, name):
    ia, ib = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    diff = ImageChops.difference(ia, ib)
    px = diff.getdata(); total = ia.width * ia.height
    exact = sum(1 for p in px if p != (0, 0, 0))
    material = sum(1 for p in px if max(p) > NOISE)
    if exact:
        diff.point(lambda v: 255 if v > NOISE else (80 if v else 0)).save(OUT / f"diff_{name}.png")
    return {"pixels": total, "differing": exact, "materialDiffering": material, "materialPct": round(material * 100 / total, 4)}

async def main():
    report = {"site": str(SITE), "entry": ENTRY, "adapter": info, "noiseThreshold": NOISE, "masks": [], "determinism": ["seeded Math.random on both sides", f"{SETTLE_MS} ms settle for page timers"], "cases": []}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for (w, h) in VIEWPORTS:
            ctx = await browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, reduced_motion="reduce")
            await ctx.add_init_script(DETERMINISM)
            ref = await ctx.new_page(); await ref.goto(f"{BASE}/{ENTRY}", wait_until="networkidle")
            pre = await ctx.new_page(); await pre.set_content(HOST)
            await pre.eval_on_selector("#f", "(f, html) => { f.srcdoc = html; }", served.read_text())
            await pre.wait_for_timeout(300); await pre.wait_for_load_state("networkidle")
            frame = next(f for f in pre.frames if f != pre.main_frame)
            await settle(ref.main_frame); await settle(frame); await ref.wait_for_timeout(SETTLE_MS)
            geo_ref, geo_pre = await ref.evaluate(GEOMETRY), await frame.evaluate(GEOMETRY)
            geo_mismatch = sum(1 for x, y in zip(geo_ref, geo_pre) if x != y) + abs(len(geo_ref) - len(geo_pre))
            for y in SCROLLS:
                await ref.evaluate(f"window.scrollTo(0,{y})"); await frame.evaluate(f"window.scrollTo(0,{y})")
                await ref.wait_for_timeout(250)
                name = f"{w}x{h}_y{y}"
                a, b = OUT / f"original_{name}.png", OUT / f"preview_{name}.png"
                await ref.screenshot(path=str(a)); await pre.screenshot(path=str(b))
                report["cases"].append({"viewport": [w, h], "scrollY": y, "elements": len(geo_ref), "geometryMismatches": geo_mismatch, **compare(a, b, name)})
            await ctx.close()
        await browser.close()
    report["visualParity"] = "verified" if all(c["materialDiffering"] == 0 and c["geometryMismatches"] == 0 for c in report["cases"]) else "failed"
    (OUT / "report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))

asyncio.run(main())
