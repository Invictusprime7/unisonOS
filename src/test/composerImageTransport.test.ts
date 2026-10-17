import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { aiComposerRequestSchema } from '@/contracts/aiComposerContract';
import { runComposerLane } from '../../supabase/functions/ai-code-assistant/composerLane';
import { shrinkBuilderTurnPayload } from '@/services/builderPayloadBudget';

const data = 'data:image/png;base64,aGVsbG8=';
const request = {
  task: 'builder_source_edit',
  page: { role: 'home', title: 'Home', route: '/', filePath: '/src/pages/Home.tsx' },
  brief: 'Use the supplied reference', instruction: 'Place the uploaded photo',
  files: { '/src/pages/Home.tsx': 'export default function Home(){return <main>Before</main>}' },
  sourceTargets: ['/src/pages/Home.tsx'], routes: [],
  runtimeContext: 'Uploaded URL: https://example.test/photo.png',
  images: [{ name: 'photo.png', data }],
};
const output = 'SUMMARY: Updated\n<<<EDIT /src/pages/Home.tsx\n<<<<<<< SEARCH\nBefore\n=======\nAfter\n>>>>>>> REPLACE\n>>>END';

describe('Composer image transport preparation', () => {
  it('passes image parts and placement text into generation and output repair', async () => {
    const calls: unknown[] = [];
    const generate = vi.fn(async messages => {
      calls.push(structuredClone(messages));
      return { content: calls.length === 1 ? 'invalid response' : output };
    });
    const response = await runComposerLane(JSON.stringify(request), {}, generate);
    expect(response.status).toBe(200);
    expect(generate).toHaveBeenCalledTimes(2);
    for (const messages of calls as Array<Array<{ role: string; content: unknown }>>) {
      const user = messages.find(message => message.role === 'user');
      expect(user?.content).toEqual([
        { type: 'text', text: expect.stringContaining(request.runtimeContext) },
        { type: 'text', text: 'Image reference: photo.png' },
        { type: 'image_url', image_url: { url: data } },
      ]);
    }
    expect(JSON.parse((await response.json()).content).fileOps[0].content).toContain('After');
  });

  it('keeps text-only requests string-based', async () => {
    const { images: _images, ...textRequest } = request;
    await runComposerLane(JSON.stringify(textRequest), {}, async messages => {
      expect(typeof messages[1].content).toBe('string');
      return { content: output };
    });
  });

  it.each(['data:image/svg+xml;base64,PHN2Zz4=', 'https://example.test/photo.png', 'data:image/png;base64,%%%'])('rejects unsupported image reference %s before generation', async value => {
    const generate = vi.fn();
    const response = await runComposerLane(JSON.stringify({ ...request, images: [{ name: 'photo', data: value }] }), {}, generate);
    expect(response.status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it('preserves images and parseable JSON when optional source is trimmed', () => {
    const payload = { mode: 'builder-source-edit', messages: [{ role: 'user', content: JSON.stringify({ ...request, files: { ...request.files, '/src/pages/Other.tsx': 'x'.repeat(20_000) } }) }] };
    const fitted = shrinkBuilderTurnPayload(payload, 2_000);
    const parsed = JSON.parse(fitted.payload.messages[0].content);
    expect(parsed.images).toEqual(request.images);
    expect(aiComposerRequestSchema.safeParse(parsed).success).toBe(true);
    expect(parsed.files['/src/pages/Home.tsx']).toBe(request.files['/src/pages/Home.tsx']);
    expect(parsed.files['/src/pages/Other.tsx']).toBeUndefined();
  });

  it('keeps client and edge contracts byte-identical', () => {
    expect(readFileSync('src/contracts/aiComposerContract.ts', 'utf8')).toBe(readFileSync('supabase/functions/_shared/aiComposerContract.ts', 'utf8'));
  });
});