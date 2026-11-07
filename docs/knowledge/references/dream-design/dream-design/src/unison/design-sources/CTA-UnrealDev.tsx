/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/CTA';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = {"inset-panel":"cta:inset-panel","cta:inset-panel":"cta:inset-panel","signal-banner":"cta:signal-banner","cta:signal-banner":"cta:signal-banner","editorial":"cta:editorial","cta:editorial":"cta:editorial","centered":"cta:centered","cta:centered":"cta:centered","gradient-banner":"cta:gradient-banner","cta:gradient-banner":"cta:gradient-banner","split-card":"cta:split-card","cta:split-card":"cta:split-card"};
const DEFAULT_VARIANT_ID = "cta:inset-panel";

export default function CTA({ props: explicitProps, variantId, ...rest }: { props?: any; variantId?: string; [key: string]: any }) {
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <Component section={{ type: "cta", variantId: resolvedId, props }} theme={THEME} />;
}

export const CTACentered = (props: any) => <CTA props={props} variantId="cta:centered" />;
export const CTASignalBanner = (props: any) => <CTA props={props} variantId="cta:signal-banner" />;
export const CTASplitCard = (props: any) => <CTA props={props} variantId="cta:split-card" />;
