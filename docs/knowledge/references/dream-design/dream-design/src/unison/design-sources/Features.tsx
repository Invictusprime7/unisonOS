/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/Features';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = {"spotlight-cards":"features:spotlight-cards","features:spotlight-cards":"features:spotlight-cards","integrations":"features:integrations","features:integrations":"features:integrations","bento-mosaic":"features:bento-mosaic","features:bento-mosaic":"features:bento-mosaic","grid":"features:grid","features:grid":"features:grid","icon-left":"features:icon-left","features:icon-left":"features:icon-left","minimal-centered":"features:minimal-centered","features:minimal-centered":"features:minimal-centered","bento":"features:bento-grid","bento-grid":"features:bento-grid","features:bento-grid":"features:bento-grid","centered":"features:minimal-centered"};
const DEFAULT_VARIANT_ID = "features:spotlight-cards";

export default function Features({ props: explicitProps, variantId, ...rest }: { props?: any; variantId?: string; [key: string]: any }) {
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <Component section={{ type: "features", variantId: resolvedId, props }} theme={THEME} />;
}

export const FeaturesBentoMosaic = (props: any) => <Features props={props} variantId="features:bento-mosaic" />;
export const FeaturesIconLeft = (props: any) => <Features props={props} variantId="features:icon-left" />;
export const FeaturesSpotlightCards = (props: any) => <Features props={props} variantId="features:spotlight-cards" />;
