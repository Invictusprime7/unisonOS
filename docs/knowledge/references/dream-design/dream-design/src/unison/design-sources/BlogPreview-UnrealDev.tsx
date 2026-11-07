/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/BlogPreview';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = {"four-columns":"blog-preview:four-columns","blog-preview:four-columns":"blog-preview:four-columns","editorial":"blog-preview:editorial","blog-preview:editorial":"blog-preview:editorial","featured-grid":"blog-preview:featured-grid","blog-preview:featured-grid":"blog-preview:featured-grid","horizontal-rail":"blog-preview:horizontal-rail","blog-preview:horizontal-rail":"blog-preview:horizontal-rail"};
const DEFAULT_VARIANT_ID = "blog-preview:four-columns";

export default function BlogPreview({ props: explicitProps, variantId, ...rest }: { props?: any; variantId?: string; [key: string]: any }) {
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <Component section={{ type: "blog-preview", variantId: resolvedId, props }} theme={THEME} />;
}

export const BlogPreviewFourColumns = (props: any) => <BlogPreview props={props} variantId="blog-preview:four-columns" />;
export const BlogPreviewHorizontalRail = (props: any) => <BlogPreview props={props} variantId="blog-preview:horizontal-rail" />;
