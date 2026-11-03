/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/FAQ';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = {"searchable":"faq:searchable","faq:searchable":"faq:searchable","editorial":"faq:editorial","faq:editorial":"faq:editorial","accordion":"faq:accordion","faq:accordion":"faq:accordion","two-column":"faq:two-column","faq:two-column":"faq:two-column","cards":"faq:cards","faq:cards":"faq:cards"};
const DEFAULT_VARIANT_ID = "faq:editorial";

export default function FAQ({ props: explicitProps, variantId, ...rest }: { props?: any; variantId?: string; [key: string]: any }) {
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <Component section={{ type: "faq", variantId: resolvedId, props }} theme={THEME} />;
}

export const FAQEditorial = (props: any) => <FAQ props={props} variantId="faq:editorial" />;
