import { describe, expect, it } from 'vitest';
import {
  canvasSize,
  exportScale,
  getGraphicFormat,
  safeArea,
} from '@/services/graphic-design/graphicFormats';
import {
  GraphicDocumentError,
  MAX_GENERATED_IMAGES,
  normalizeGraphicDocument,
  restoreImageSources,
  stripImageSources,
  type GraphicDocument,
  type TextLayer,
} from '@/services/graphic-design/graphicDocument';
import { contrastRatio, designCheckFixInstruction, runDesignCheck } from '@/services/graphic-design/graphicDesignCheck';
import { detectGraphicRequest } from '@/services/graphic-design/graphicIntent';
import { googleFontStylesheetUrl, findGraphicFont } from '@/services/graphic-design/graphicFonts';

const letter = getGraphicFormat('flyer-us-letter');

/** A clean flyer: dark headline on white, inside the safe area, two colours. */
function cleanFlyer(overrides: Partial<TextLayer> = {}): GraphicDocument {
  const safe = safeArea(letter);
  return normalizeGraphicDocument({
    formatId: 'flyer-us-letter',
    title: 'Spring sale',
    palette: ['#1f3d2b', '#e8b04a'],
    pages: [{
      id: 'p1',
      background: '#ffffff',
      layers: [
        { type: 'shape', id: 'band', shape: 'rect', x: 0, y: 0, width: 840, height: 200, fill: '#1f3d2b' },
        { type: 'text', id: 'headline', role: 'headline', text: 'Spring Sale', x: safe.x, y: 360, width: safe.width, fontSize: 96, fontWeight: 800, color: '#1f3d2b', fontFamily: 'Montserrat', ...overrides },
        { type: 'text', id: 'details', role: 'body', text: '20% off all bouquets', x: safe.x, y: 520, width: safe.width, fontSize: 28, color: '#222222', fontFamily: 'Inter' },
        { type: 'shape', id: 'accent', shape: 'rect', x: safe.x, y: 620, width: 200, height: 8, fill: '#e8b04a' },
      ],
    }],
  });
}

describe('graphic formats', () => {
  it('a US letter flyer is 8.5 × 11 in plus a 1/8 in bleed on each side', () => {
    expect(canvasSize(letter)).toEqual({ width: 816 + 24, height: 1056 + 24 });
  });

  it('print formats export at 300 DPI', () => {
    expect(exportScale(letter).dpi).toBe(300);
    expect(exportScale(getGraphicFormat('business-card-us')).dpi).toBe(300);
  });

  it('a roll-up banner export is capped to a size the browser can draw', () => {
    const banner = getGraphicFormat('banner-rollup');
    const { multiplier, dpi } = exportScale(banner);
    const { width, height } = canvasSize(banner);
    expect(Math.max(width, height) * multiplier).toBeLessThanOrEqual(12_000);
    expect(width * height * multiplier ** 2).toBeLessThanOrEqual(100_000_000);
    expect(dpi).toBeLessThan(300);
  });

  it('web banners export at their exact pixel size with no bleed', () => {
    const web = getGraphicFormat('banner-web');
    expect(canvasSize(web)).toEqual({ width: 1920, height: 600 });
    expect(exportScale(web).multiplier).toBe(1);
  });

  it('business cards have a front and a back', () => {
    expect(getGraphicFormat('business-card-us').pageNames).toEqual(['Front', 'Back']);
  });

  it('only requests font weights the typeface ships', () => {
    expect(googleFontStylesheetUrl(findGraphicFont('Bebas Neue')!)).toContain('Bebas+Neue:wght@400&');
    expect(googleFontStylesheetUrl(findGraphicFont('Lora')!)).toContain('ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700');
  });
});

describe('normalizeGraphicDocument', () => {
  it('fixes colours, fonts and weights and drops unusable layers', () => {
    const doc = normalizeGraphicDocument({
      formatId: 'flyer-us-letter',
      pages: [{
        background: 'FFF',
        layers: [
          { type: 'text', text: 'Hello', color: '#ABC', fontFamily: 'Comic Sans', fontWeight: 650 },
          { type: 'text', text: '   ' },
          { type: 'video', src: 'x' },
          { type: 'shape', shape: 'triangle', fill: 'red' },
        ],
      }],
    });
    const [text, shape] = doc.pages[0].layers;
    expect(doc.pages[0].background).toBe('#ffffff');
    expect(doc.pages[0].layers).toHaveLength(2);
    expect(text).toMatchObject({ type: 'text', color: '#aabbcc', fontFamily: 'Inter', fontWeight: 600 });
    expect(shape).toMatchObject({ type: 'shape', shape: 'rect', fill: '#dddddd' });
  });

  it('keeps no more pages than the format has', () => {
    const page = { layers: [{ type: 'text', text: 'Hi' }] };
    expect(normalizeGraphicDocument({ pages: [page, page, page] }, { formatId: 'business-card-us' }).pages).toHaveLength(2);
    expect(normalizeGraphicDocument({ pages: [page, page] }, { formatId: 'flyer-us-letter' }).pages).toHaveLength(1);
  });

  it('gives duplicate layer ids unique ids', () => {
    const doc = normalizeGraphicDocument({ pages: [{ layers: [{ type: 'text', id: 'a', text: 'One' }, { type: 'text', id: 'a', text: 'Two' }] }] });
    expect(doc.pages[0].layers.map((layer) => layer.id)).toEqual(['a', 'a-2']);
  });

  it(`asks for at most ${MAX_GENERATED_IMAGES} new photos per design`, () => {
    const photo = { type: 'image', width: 100, height: 100, generate: { prompt: 'flowers' } };
    const doc = normalizeGraphicDocument({ pages: [{ layers: [photo, photo, photo] }] });
    expect(doc.pages[0].layers.filter((layer) => layer.type === 'image' && layer.generate)).toHaveLength(2);
  });

  it('only links an image to a reference the owner actually imported', () => {
    const doc = normalizeGraphicDocument(
      { pages: [{ layers: [{ type: 'image', referenceId: 'ref-1' }, { type: 'image', referenceId: 'ref-9' }] }] },
      { referenceIds: ['ref-1'] },
    );
    expect(doc.pages[0].layers.map((layer) => layer.type === 'image' && layer.referenceId)).toEqual(['ref-1', null]);
  });

  it('rejects unsafe image sources', () => {
    const doc = normalizeGraphicDocument({ pages: [{ layers: [{ type: 'image', src: 'javascript:alert(1)' }] }] });
    expect(doc.pages[0].layers[0]).toMatchObject({ type: 'image', src: null });
  });

  it('refuses a design with nothing usable instead of inventing content', () => {
    expect(() => normalizeGraphicDocument({ pages: [{ layers: [] }] })).toThrow(GraphicDocumentError);
    expect(() => normalizeGraphicDocument('nope')).toThrow(GraphicDocumentError);
  });
});

describe('image data stays out of edit requests', () => {
  it('replaces image data with tokens and restores it afterwards', () => {
    const src = 'data:image/png;base64,AAAA';
    const doc = normalizeGraphicDocument({ pages: [{ layers: [{ type: 'image', id: 'photo', src }] }] });
    const { document, assets } = stripImageSources(doc);
    expect(JSON.stringify(document)).not.toContain('base64');
    expect(document.pages[0].layers[0]).toMatchObject({ src: 'asset:photo' });
    expect(restoreImageSources(document, assets).pages[0].layers[0]).toMatchObject({ src });
  });
});

describe('design check', () => {
  it('passes a clean, simple design', () => {
    expect(runDesignCheck(cleanFlyer())).toEqual([]);
  });

  it('flags more than three colours', () => {
    const doc = cleanFlyer();
    const extra = ['#ff0000', '#0000ff', '#9b30ff'].map((fill, index) => ({
      type: 'shape' as const, id: `dot-${index}`, shape: 'ellipse' as const, x: 60 + index * 40, y: 700, width: 30, height: 30,
      fill, stroke: null, strokeWidth: 0, radius: 0, rotation: 0, opacity: 1,
    }));
    doc.pages[0].layers.push(...extra);
    expect(runDesignCheck(doc).map((finding) => finding.rule)).toContain('colors');
  });

  it('flags a small headline', () => {
    expect(runDesignCheck(cleanFlyer({ fontSize: 24 })).map((f) => f.rule)).toContain('headline');
  });

  it('flags text that would be trimmed off a print', () => {
    expect(runDesignCheck(cleanFlyer({ x: 4 })).find((f) => f.rule === 'safe-area')?.severity).toBe('problem');
  });

  it('flags low-contrast text', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(runDesignCheck(cleanFlyer({ color: '#eeeeee' })).map((f) => f.rule)).toContain('contrast');
  });

  it('flags tiny print text', () => {
    const doc = cleanFlyer();
    (doc.pages[0].layers[2] as TextLayer).fontSize = 9;
    expect(runDesignCheck(doc).map((f) => f.rule)).toContain('tiny-text');
  });

  it('flags overlapping text', () => {
    expect(runDesignCheck(cleanFlyer({ y: 520 })).map((f) => f.rule)).toContain('overlap');
  });

  it('turns findings into one instruction for Affinity', () => {
    const findings = runDesignCheck(cleanFlyer({ fontSize: 24 }));
    expect(designCheckFixInstruction(findings)).toMatch(/^Fix these design check findings/);
  });
});

describe('detectGraphicRequest', () => {
  it.each([
    ['Design a flyer for my bakery opening', 'flyer', 'flyer-us-letter'],
    ['I need business cards for my plumbing company', 'business-card', 'business-card-us'],
    ['A letterhead for Harbor Legal', 'letterhead', 'letterhead-us-letter'],
    ['Make a poster for our jazz night', 'poster', 'poster-18x24'],
    ['A roll-up banner for the trade show', 'banner', 'banner-rollup'],
    ['A LinkedIn banner for my coaching business', 'banner', 'banner-web'],
    ['An A5 leaflet for the school fair', 'flyer', 'flyer-a5'],
    ['Design a flyer for my website launch', 'flyer', 'flyer-us-letter'],
  ])('%s → %s', (message, category, formatId) => {
    const request = detectGraphicRequest(message);
    expect(request?.category).toBe(category);
    expect(request?.format.id).toBe(formatId);
  });

  it.each([
    'Help me create a professional website for my business.',
    'Build a website for my poster printing shop',
    'Add a banner to my website',
    'I want a hero banner section on the home page',
  ])('leaves website requests to site planning: %s', (message) => {
    expect(detectGraphicRequest(message)).toBeNull();
  });
});
