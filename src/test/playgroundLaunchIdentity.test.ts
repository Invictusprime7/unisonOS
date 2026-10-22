import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/components/creatives/WebBuilder.tsx'), 'utf8');

describe("Creator's Playground confirmed launch identity", () => {
  it('passes the distinct confirmed site and project IDs to the setup surfaces', () => {
    const modalStart = source.indexOf('<CreatorPlaygroundModal');
    const modalEnd = source.indexOf('/>', modalStart);
    const modalProps = source.slice(modalStart, modalEnd);

    expect(modalStart).toBeGreaterThanOrEqual(0);
    expect(modalProps).toContain('businessId={businessId || null}');
    expect(modalProps).toContain('siteId={effectiveRouteState?.siteId ?? launch?.siteId ?? null}');
    expect(modalProps).toContain('projectId={projectId ?? null}');
    expect(modalProps).toContain('systemType={systemType ?? null}');
    expect(source).not.toContain('siteId={projectId || undefined}');
    expect(source).not.toContain('siteId: projectId');
  });
});