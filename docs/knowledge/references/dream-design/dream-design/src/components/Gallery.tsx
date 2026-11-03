/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/Gallery';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = {"case-study":"gallery:case-study","gallery:case-study":"gallery:case-study","mosaic":"gallery:editorial-mosaic","editorial-mosaic":"gallery:editorial-mosaic","gallery:editorial-mosaic":"gallery:editorial-mosaic","masonry":"gallery:masonry","gallery:masonry":"gallery:masonry","grid":"gallery:cinematic-grid","cinematic-grid":"gallery:cinematic-grid","gallery:cinematic-grid":"gallery:cinematic-grid","lightbox":"gallery:lightbox-grid","lightbox-grid":"gallery:lightbox-grid","gallery:lightbox-grid":"gallery:lightbox-grid","feature-split":"gallery:feature-split","gallery:feature-split":"gallery:feature-split","reel":"gallery:horizontal-reel","horizontal-reel":"gallery:horizontal-reel","gallery:horizontal-reel":"gallery:horizontal-reel","collection-tiles":"gallery:collection-tiles","gallery:collection-tiles":"gallery:collection-tiles"};
const DEFAULT_VARIANT_ID = "gallery:case-study";

export default function Gallery({ props: explicitProps, variantId, ...rest }: { props?: any; variantId?: string; [key: string]: any }) {
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <Component section={{ type: "gallery", variantId: resolvedId, props }} theme={THEME} />;
}
