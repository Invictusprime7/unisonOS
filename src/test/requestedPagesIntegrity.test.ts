import { describe, expect, it } from 'vitest';
import { deriveChatLaunchPlan } from '@/services/launch/chatLaunchPlan';
import { planSiteTopology } from '@/platform/core/siteTopologyPlanner';

const routes = (brief: string) =>
  (deriveChatLaunchPlan(brief, { promptFirst: true }).creationInput?.pages ?? []).map((page) => page.route);

describe('owner-requested pages survive planning', () => {
  it('music: releases, tour dates and fan sign-ups — never an unrelated FAQ from "Help me"', () => {
    const r = routes('Help me create a website for my music with releases, tour dates and fan sign-ups.');
    expect(r).toEqual(expect.arrayContaining(['/', '/releases', '/tour', '/fan-sign-ups']));
    expect(r).not.toContain('/faq');
  });

  it("music: Affinity's confirmed summary bullets become pages, direction bullets do not", () => {
    const brief = 'Confirmed site direction:\nHere is the plan for your site:\n\n- **Site identity**: 3manbeatz\n- **Releases**: latest tracks\n- **Tour dates**: upcoming shows\n- **Fan sign-up**: email capture\n- **Look & feel**: Bold\n\nConversation details:\nHelp me create a website for my music.\n3manbeatz';
    const r = routes(brief);
    expect(r).toEqual(expect.arrayContaining(['/releases', '/tour', '/fan-sign-up']));
    expect(r.some((route) => /identity|look/.test(route))).toBe(false);
    expect(r).not.toContain('/faq');
  });

  it('wedding: a single "RSVP page" is kept as its own page', () => {
    expect(routes('A wedding website with our story, schedule and an RSVP page.')).toEqual(expect.arrayContaining(['/rsvp', '/schedule']));
  });

  it('festival: lineup, schedule, venue maps and ticketing', () => {
    expect(routes('A festival site with lineup, schedule, venue maps and ticketing.')).toEqual(expect.arrayContaining(['/lineup', '/schedule', '/venue-maps', '/ticketing']));
  });

  it('sports publication: news and live scores', () => {
    expect(routes('A sports publication with news, article pages and live scores.')).toEqual(expect.arrayContaining(['/news', '/live']));
  });

  it('ecommerce: product details and checkout', () => {
    expect(routes('An online store with catalog, product details, cart and checkout.')).toEqual(expect.arrayContaining(['/checkout', '/product-details']));
  });

  it('SaaS: sign in and dashboard', () => {
    expect(routes('A SaaS site with marketing pages, sign in and a dashboard.')).toEqual(expect.arrayContaining(['/sign-in', '/dashboard']));
  });

  it('style words never become pages', () => {
    expect(routes('A simple website for my bakery. Bold and warm colors.')).toEqual(['/']);
  });

  it('named pages reach the canonical topology', () => {
    const plan = deriveChatLaunchPlan('A wedding website with our story, schedule and an RSVP page.', { promptFirst: true });
    const built = planSiteTopology('universal', 'Wedding', { explicitPages: plan.creationInput!.pages, restrictToAdditionalPages: true });
    const planned = JSON.stringify(built);
    expect(planned).toContain('/rsvp');
    expect(planned).toContain('/schedule');
  });
});
