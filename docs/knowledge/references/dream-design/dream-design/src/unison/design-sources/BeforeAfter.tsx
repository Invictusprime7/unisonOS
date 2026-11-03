/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/BeforeAfter';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = {"reveal-panel":"before-after:reveal-panel","before-after:reveal-panel":"before-after:reveal-panel","slider":"before-after:slider","before-after:slider":"before-after:slider","grid":"before-after:grid","before-after:grid":"before-after:grid","case-study":"before-after:case-study","before-after:case-study":"before-after:case-study"};
const DEFAULT_VARIANT_ID = "before-after:reveal-panel";

export default function BeforeAfter({ props: explicitProps, variantId, ...rest }: { props?: any; variantId?: string; [key: string]: any }) {
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <Component section={{ type: "before-after", variantId: resolvedId, props }} theme={THEME} />;
}

export const BeforeAfterCaseStudy = (props: any) => <BeforeAfter props={props} variantId="before-after:case-study" />;
export const BeforeAfterRevealPanel = (props: any) => <BeforeAfter props={props} variantId="before-after:reveal-panel" />;
