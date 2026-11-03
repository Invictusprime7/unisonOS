/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/Footer';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = {"brand-social":"footer:brand-social","footer:brand-social":"footer:brand-social","multi-column":"footer:multi-column","footer:multi-column":"footer:multi-column","columns":"footer:columns","footer:columns":"footer:columns","centered-minimal":"footer:centered-minimal","footer:centered-minimal":"footer:centered-minimal","dark-band":"footer:dark-band","footer:dark-band":"footer:dark-band"};
const DEFAULT_VARIANT_ID = "footer:brand-social";

export default function Footer({ props: explicitProps, variantId, ...rest }: { props?: any; variantId?: string; [key: string]: any }) {
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <Component section={{ type: "footer", variantId: resolvedId, props }} theme={THEME} />;
}

export const FooterBrandSocial = (props: any) => <Footer props={props} variantId="footer:brand-social" />;
