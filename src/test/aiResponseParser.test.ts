import { describe, expect, it } from 'vitest';
import { extractMultiFileOutput, extractStylesheetOutput } from '@/utils/aiResponseParser';
import * as responseParser from '@/utils/aiResponseParser';

describe('AI response file extraction', () => {
  it('exposes extraction only, not a parallel response-to-VFS authoring API', () => {
    expect(Object.keys(responseParser).sort()).toEqual([
      'extractMultiFileOutput',
      'extractStylesheetOutput',
    ]);
  });

  it('extracts a prose-wrapped fenced JSON patch for theme and image edits', () => {
    const response = [
      'I updated the theme and added the requested hero image.',
      '```json',
      JSON.stringify({
        files: {
          '/src/index.css': ':root { --primary: 12 85% 48%; }',
          '/src/pages/Home.tsx': 'export default function Home() { return <img src="https://images.unsplash.com/photo-1?w=1200&q=80" alt="Hero" />; }',
        },
        explanation: 'Applied the new visual direction.',
      }, null, 2),
      '```',
      'The rest of the page is unchanged.',
    ].join('\n');

    expect(extractMultiFileOutput(response)).toEqual({
      files: {
        '/src/index.css': ':root { --primary: 12 85% 48%; }',
        '/src/pages/Home.tsx': 'export default function Home() { return <img src="https://images.unsplash.com/photo-1?w=1200&q=80" alt="Hero" />; }',
      },
      explanation: 'Applied the new visual direction.',
    });
  });

  it('recovers a fenced file contract with unescaped JSX quotes', () => {
    const response = [
      '```json',
      '{',
      '  "files": {',
      '    "/src/pages/Checkout.tsx": "export default function Checkout() {\\n  return <h1 className="text-primary">Confirm Your Session</h1>;\\n}"',
      '  },',
      '  "explanation": "Created checkout."',
      '}',
      '```',
    ].join('\n');

    expect(extractMultiFileOutput(response)).toEqual({
      files: {
        '/src/pages/Checkout.tsx': 'export default function Checkout() {\n  return <h1 className="text-primary">Confirm Your Session</h1>;\n}',
      },
    });
  });

  it('recovers a complete file contract when the closing markdown fence is missing', () => {
    const response = [
      '```json',
      '{',
      '  "files": {',
      '    "/src/pages/Checkout.tsx": "export default function Checkout() {\\n  return <span className="text-primary">Pay now</span>;\\n}"',
      '  },',
      '  "explanation": "Created checkout."',
      '}',
    ].join('\n');

    expect(extractMultiFileOutput(response)?.files['/src/pages/Checkout.tsx']).toContain(
      '<span className="text-primary">Pay now</span>',
    );
  });

  it('normalizes file objects that wrap source in a content property', () => {
    const response = JSON.stringify({
      files: {
        '/src/App.tsx': { content: 'export default function App() { return <main />; }' },
      },
    });

    expect(extractMultiFileOutput(response)).toEqual({
      files: {
        '/src/App.tsx': 'export default function App() { return <main />; }',
      },
    });
  });

  it('extracts explicit VFS deletions with the changed source files', () => {
    const response = JSON.stringify({
      files: {
        '/src/pages/Booking.tsx': 'export default function Booking() { return <main>Updated flow</main>; }',
      },
      deletions: ['/src/components/LegacyBookingForm.tsx'],
    });

    expect(extractMultiFileOutput(response)).toEqual({
      files: {
        '/src/pages/Booking.tsx': 'export default function Booking() { return <main>Updated flow</main>; }',
      },
      deletions: ['/src/components/LegacyBookingForm.tsx'],
    });
  });

  it('routes a prose-wrapped CSS theme response to the canonical stylesheet', () => {
    const response = [
      'Here is the updated theme:',
      '```css',
      ':root { --primary: 12 85% 48%; --background: 36 33% 97%; }',
      'body { font-family: "DM Sans", sans-serif; }',
      '```',
    ].join('\n');

    expect(extractStylesheetOutput(response)).toEqual({
      '/src/index.css': ':root { --primary: 12 85% 48%; --background: 36 33% 97%; }\nbody { font-family: "DM Sans", sans-serif; }',
    });
  });
});
