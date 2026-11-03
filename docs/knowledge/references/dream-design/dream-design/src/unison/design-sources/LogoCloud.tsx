/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/LogoCloud';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = {"cinematic":"logo-cloud:cinematic","logo-cloud:cinematic":"logo-cloud:cinematic","static-grid":"logo-cloud:static-grid","logo-cloud:static-grid":"logo-cloud:static-grid","reveal-tiles":"logo-cloud:reveal-tiles","logo-cloud:reveal-tiles":"logo-cloud:reveal-tiles","grid":"logo-cloud:grid","logo-cloud:grid":"logo-cloud:grid","marquee":"logo-cloud:marquee","logo-cloud:marquee":"logo-cloud:marquee","brand-lockup":"logo-cloud:brand-lockup","logo-cloud:brand-lockup":"logo-cloud:brand-lockup","wordmark-row":"logo-cloud:wordmark-row","logo-cloud:wordmark-row":"logo-cloud:wordmark-row"};
const DEFAULT_VARIANT_ID = "logo-cloud:reveal-tiles";

export default function LogoCloud({ props: explicitProps, variantId, ...rest }: { props?: any; variantId?: string; [key: string]: any }) {
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <Component section={{ type: "logo-cloud", variantId: resolvedId, props }} theme={THEME} />;
}

export const LogoCloudCinematic = (props: any) => <LogoCloud props={props} variantId="logo-cloud:cinematic" />;
