/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/Hero';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = {"image-stream":"hero:image-stream","hero:image-stream":"hero:image-stream","launch-showcase":"hero:launch-showcase","hero:launch-showcase":"hero:launch-showcase","prisma-cinematic":"hero:prisma-cinematic","hero:prisma-cinematic":"hero:prisma-cinematic","image-fan":"hero:image-fan","hero:image-fan":"hero:image-fan","variable-type":"hero:variable-type","hero:variable-type":"hero:variable-type","underline":"hero:underline","hero:underline":"hero:underline","editorial-banner":"hero:editorial-banner","hero:editorial-banner":"hero:editorial-banner","centered":"hero:centered","hero:centered":"hero:centered","split":"hero:split-image","split-image":"hero:split-image","hero:split-image":"hero:split-image","full-bleed":"hero:full-bleed","hero:full-bleed":"hero:full-bleed","page-title":"hero:page-title","hero:page-title":"hero:page-title","commerce-gradient":"hero:commerce-gradient","hero:commerce-gradient":"hero:commerce-gradient","showcase-panel":"hero:showcase-panel","hero:showcase-panel":"hero:showcase-panel"};
const DEFAULT_VARIANT_ID = "hero:centered";

export default function Hero({ props: explicitProps, variantId, ...rest }: { props?: any; variantId?: string; [key: string]: any }) {
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <Component section={{ type: "hero", variantId: resolvedId, props }} theme={THEME} />;
}
