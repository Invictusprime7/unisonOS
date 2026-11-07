/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/Stats';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = {"proof-grid":"stats:proof-grid","stats:proof-grid":"stats:proof-grid","metric-cards":"stats:metric-cards","stats:metric-cards":"stats:metric-cards","bold":"stats:bold","stats:bold":"stats:bold","row":"stats:row","stats:row":"stats:row","banded-grid":"stats:banded-grid","stats:banded-grid":"stats:banded-grid","highlight":"stats:highlight","stats:highlight":"stats:highlight"};
const DEFAULT_VARIANT_ID = "stats:metric-cards";

export default function Stats({ props: explicitProps, variantId, ...rest }: { props?: any; variantId?: string; [key: string]: any }) {
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <Component section={{ type: "stats", variantId: resolvedId, props }} theme={THEME} />;
}

export const StatsBandedGrid = (props: any) => <Stats props={props} variantId="stats:banded-grid" />;
