/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/Pricing';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = {"spotlight":"pricing:spotlight","pricing:spotlight":"pricing:spotlight","feature-table":"pricing:feature-table","pricing:feature-table":"pricing:feature-table","billing-toggle":"pricing:billing-toggle","pricing:billing-toggle":"pricing:billing-toggle","comparison-table":"pricing:comparison-table","pricing:comparison-table":"pricing:comparison-table","creative":"pricing:creative","pricing:creative":"pricing:creative","tiers":"pricing:tiers","pricing:tiers":"pricing:tiers","comparison":"pricing:comparison","pricing:comparison":"pricing:comparison","accordion":"pricing:accordion","pricing:accordion":"pricing:accordion"};
const DEFAULT_VARIANT_ID = "pricing:feature-table";

export default function Pricing({ props: explicitProps, variantId, ...rest }: { props?: any; variantId?: string; [key: string]: any }) {
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <Component section={{ type: "pricing", variantId: resolvedId, props }} theme={THEME} />;
}
