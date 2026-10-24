import { describe, expect, it } from 'vitest';
import { AUTHORED_MARKETPLACE_TEMPLATES } from '@/marketplace/authoredTemplatePreviews';
import { templateStarterData } from '@/marketplace/templateStarterData';

describe('marketplace public starter content', () => {
  it('materializes Pollen catalog prices rather than generic services', () => {
    const template = AUTHORED_MARKETPLACE_TEMPLATES.find(item => item.id === 'pollen-objects');
    if (!template) throw new Error('Missing Pollen');
    const { creatorData } = templateStarterData(template);
    expect(Object.values(creatorData.products).find(item => item.name === 'Sunday cup')?.price).toBe(38);
    expect(Object.values(creatorData.products).find(item => item.name === 'Field watch')?.price).toBe(165);
    expect(creatorData.services).toEqual({});
    expect(creatorData.businessInfo).toEqual({ businessName: 'Pollen Objects' });
    expect(creatorData.forms).toEqual({});
  });
  it('preserves service, FAQ and team sample content without seller connections', () => {
    const template = AUTHORED_MARKETPLACE_TEMPLATES.find(item => item.id === 'aster-skin-studio');
    if (!template) throw new Error('Missing Aster');
    const { creatorData, mediaAssets } = templateStarterData(template);
    expect(Object.values(creatorData.services).find(item => item.name === 'Aster facial')?.price).toBe(120);
    expect(Object.values(creatorData.team).some(item => item.name === 'Nia Carter')).toBe(true);
    expect(Object.keys(creatorData.faqs).length).toBeGreaterThan(0);
    expect(mediaAssets.length).toBeGreaterThan(0);
    expect(creatorData.componentInstances).toEqual({});
  });
});