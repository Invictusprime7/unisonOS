/**
 * Pricing Variant: Accordion
 * Stacked disclosure rows — dense plan detail without a wide matrix.
 */

import React, { useState } from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl } from '../../themeUtils';
import { PricingFrame, PricingCTA, normalizePricingTiers } from './PricingFrame';

export const PricingAccordion: React.FC<BaseSectionProps<'pricing'>> = ({ section, theme }) => {
  const tiers = normalizePricingTiers(section.props.tiers, (section.props as Record<string, unknown>).items);
  const defaultOpen = Math.max(0, tiers.findIndex((tier) => tier.highlighted));
  const [open, setOpen] = useState<number>(defaultOpen);

  return (
    <PricingFrame
      variantId="pricing:accordion"
      theme={theme}
      headline={section.props.headline}
      subheadline={section.props.subheadline}
    >
      <div className="mx-auto max-w-3xl">
        {tiers.map((tier, i) => {
          const expanded = open === i;
          return (
            <div
              key={i}
              className="mb-3"
              style={{
                background: hsl(theme.colors.card),
                color: hsl(theme.colors.cardForeground),
                borderRadius: theme.radius,
                border: `1px solid ${expanded ? hsl(theme.colors.primary) : hsl(theme.colors.border)}`,
              }}
            >
              <h3 className="m-0">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? -1 : i)}
                  className="flex w-full items-center justify-between gap-4 bg-transparent p-5 text-left"
                  style={{ fontFamily: theme.typography.headingFont, color: 'inherit' }}
                >
                  <span className="flex items-center gap-3">
                    <span data-ut-slot={`pricing.name`} className="text-base font-semibold">{tier.name}</span>
                    {tier.badge && (
                      <span data-ut-slot={`pricing.badge`} className="px-2 py-0.5 text-xs" style={{ borderRadius: theme.radius, background: hsl(theme.colors.accent), color: hsl(theme.colors.accentForeground) }}>
                        {tier.badge}
                      </span>
                    )}
                  </span>
                  <span data-ut-slot={`pricing.price`} className="text-base font-semibold">
                    {tier.price}
                    {tier.period && <span className="text-xs font-normal" style={{ color: hsl(theme.colors.mutedForeground) }}> /{tier.period}</span>}
                  </span>
                </button>
              </h3>
              {expanded && (
                <div className="px-5 pb-5">
                  {tier.description && (
                    <p data-ut-slot={`pricing.description`} className="mb-3 text-sm" style={{ color: hsl(theme.colors.mutedForeground) }}>{tier.description}</p>
                  )}
                  <ul className="list-none space-y-2 p-0 text-sm">
                    {tier.features.map((feature, fi) => (
                      <li key={fi} className="flex gap-2">
                        <span aria-hidden="true" style={{ color: hsl(theme.colors.primary) }}>✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <PricingCTA tier={tier} theme={theme} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PricingFrame>
  );
};
