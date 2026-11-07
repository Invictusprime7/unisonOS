/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/Services';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = {"expandable":"services:expandable","services:expandable":"services:expandable","editorial-rows":"services:editorial-rows","services:editorial-rows":"services:editorial-rows","bento-spotlight":"services:bento-spotlight","services:bento-spotlight":"services:bento-spotlight","product-cards":"services:product-cards","services:product-cards":"services:product-cards","grid":"services:card-grid","card-grid":"services:card-grid","services:card-grid":"services:card-grid","alternating":"services:alternating","services:alternating":"services:alternating","list":"services:compact-list","compact-list":"services:compact-list","services:compact-list":"services:compact-list"};
const DEFAULT_VARIANT_ID = "services:editorial-rows";

export default function Services({ props: explicitProps, variantId, ...rest }: { props?: any; variantId?: string; [key: string]: any }) {
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <Component section={{ type: "services", variantId: resolvedId, props }} theme={THEME} />;
}
