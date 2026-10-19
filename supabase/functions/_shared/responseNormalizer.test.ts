import { buildResponseBody } from './responseNormalizer.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test('flags explanation-only out-of-scope replies with the reason', () => {
  const body = buildResponseBody({
    content:
      "I can't add a booking calendar to this page. This is outside my scope because the booking capability is not installed on this site. To unlock this, install the booking pack from the Catalog, then I can wire the button.",
    reasoning: '',
    generatedImageUrl: '',
  });
  assert(body.actionType === 'explain', 'expected explain action type');
  const scope = body.outOfScope as { reason: string } | undefined;
  assert(!!scope, 'expected outOfScope metadata');
  assert(scope!.reason.includes('booking capability'), 'reason should carry the explanation');
});

Deno.test('does not flag ordinary explanations as out of scope', () => {
  const body = buildResponseBody({
    content: 'Your hero uses a split layout with a single primary CTA.',
    reasoning: '',
    generatedImageUrl: '',
  });
  assert(body.outOfScope === undefined, 'ordinary explanation must not be flagged');
});

Deno.test('does not flag file patches even when they mention limits', () => {
  const body = buildResponseBody({
    content: JSON.stringify({ files: { '/src/pages/Home.tsx': 'export default function Home(){return null}' } }),
    reasoning: '',
    generatedImageUrl: '',
  });
  assert(body.actionType === 'patch', 'expected patch action type');
  assert(body.outOfScope === undefined, 'patches are never out-of-scope notes');
});

Deno.test('preserves reasoning text for the chat panel', () => {
  const body = buildResponseBody({
    content: 'Done.',
    reasoning: 'Understanding: you asked for a warmer palette. Plan: shift the accent hue.',
    generatedImageUrl: '',
  });
  assert(typeof body.thinking === 'string' && body.thinking.includes('Understanding:'), 'reasoning must survive into the response');
});
