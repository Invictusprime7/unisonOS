/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/Team';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = {"editorial":"team:editorial","team:editorial":"team:editorial","profile-cards":"team:profile-cards","team:profile-cards":"team:profile-cards","portrait-grid":"team:portrait-grid","team:portrait-grid":"team:portrait-grid","roster-rail":"team:roster-rail","team:roster-rail":"team:roster-rail","lead-spotlight":"team:lead-spotlight","team:lead-spotlight":"team:lead-spotlight"};
const DEFAULT_VARIANT_ID = "team:profile-cards";

export default function Team({ props: explicitProps, variantId, ...rest }: { props?: any; variantId?: string; [key: string]: any }) {
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <Component section={{ type: "team", variantId: resolvedId, props }} theme={THEME} />;
}
