/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
import React from 'react';
import { REGISTERED_VARIANTS } from './recipes/Testimonials';
import { THEME } from './theme';

const LAYOUT_VARIANTS: Record<string, string> = {"columns":"testimonials:columns","testimonials:columns":"testimonials:columns","marquee":"testimonials:marquee","testimonials:marquee":"testimonials:marquee","editorial":"testimonials:editorial","testimonials:editorial":"testimonials:editorial","vertical-marquee":"testimonials:vertical-marquee","testimonials:vertical-marquee":"testimonials:vertical-marquee","voice":"testimonials:voice","testimonials:voice":"testimonials:voice","grid":"testimonials:grid","testimonials:grid":"testimonials:grid","carousel":"testimonials:rail","rail":"testimonials:rail","testimonials:rail":"testimonials:rail","single":"testimonials:spotlight","spotlight":"testimonials:spotlight","testimonials:spotlight":"testimonials:spotlight"};
const DEFAULT_VARIANT_ID = "testimonials:columns";

export default function Testimonials({ props: explicitProps, variantId, ...rest }: { props?: any; variantId?: string; [key: string]: any }) {
  const props = explicitProps ?? rest;
  const requestedId = variantId || (props && LAYOUT_VARIANTS[props.layout]) || DEFAULT_VARIANT_ID;
  const resolvedId = REGISTERED_VARIANTS[requestedId] ? requestedId : DEFAULT_VARIANT_ID;
  const Component = REGISTERED_VARIANTS[resolvedId];
  if (!Component) return null;
  return <Component section={{ type: "testimonials", variantId: resolvedId, props }} theme={THEME} />;
}

export const TestimonialsColumns = (props: any) => <Testimonials props={props} variantId="testimonials:columns" />;
export const TestimonialsRail = (props: any) => <Testimonials props={props} variantId="testimonials:rail" />;
