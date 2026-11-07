/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/Navbar';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = {"catalog-bar":"navbar:catalog-bar","navbar:catalog-bar":"navbar:catalog-bar","floating-pill":"navbar:floating-pill","navbar:floating-pill":"navbar:floating-pill","standard":"navbar:standard","navbar:standard":"navbar:standard","centered-logo":"navbar:centered-logo","navbar:centered-logo":"navbar:centered-logo","minimal-dark":"navbar:minimal-dark","navbar:minimal-dark":"navbar:minimal-dark"};
const DEFAULT_VARIANT_ID = "navbar:standard";

export default function Navbar({ props: explicitProps, variantId, ...rest }: { props?: any; variantId?: string; [key: string]: any }) {
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <Component section={{ type: "navbar", variantId: resolvedId, props }} theme={THEME} />;
}

export const NavbarFloatingPill = (props: any) => <Navbar props={props} variantId="navbar:floating-pill" />;
export const NavbarMinimalDark = (props: any) => <Navbar props={props} variantId="navbar:minimal-dark" />;
export const NavbarStandard = (props: any) => <Navbar props={props} variantId="navbar:standard" />;
