/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/Contact';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = {"checkout-panel":"contact:checkout-panel","contact:checkout-panel":"contact:checkout-panel","map-studio":"contact:map-studio","contact:map-studio":"contact:map-studio","editorial-form":"contact:editorial-form","contact:editorial-form":"contact:editorial-form","compact-card":"contact:compact-card","contact:compact-card":"contact:compact-card","centered":"contact:centered","contact:centered":"contact:centered","split-card":"contact:split-card","contact:split-card":"contact:split-card","minimal-inline":"contact:minimal-inline","contact:minimal-inline":"contact:minimal-inline"};
const DEFAULT_VARIANT_ID = "contact:editorial-form";

export default function Contact({ props: explicitProps, variantId, ...rest }: { props?: any; variantId?: string; [key: string]: any }) {
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <Component section={{ type: "contact", variantId: resolvedId, props }} theme={THEME} />;
}

export const ContactEditorialForm = (props: any) => <Contact props={props} variantId="contact:editorial-form" />;
export const ContactMapStudio = (props: any) => <Contact props={props} variantId="contact:map-studio" />;
export const ContactMinimalInline = (props: any) => <Contact props={props} variantId="contact:minimal-inline" />;
