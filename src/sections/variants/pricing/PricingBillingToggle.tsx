/**
 * Pricing Variant: Billing Toggle
 *
 * Monthly / yearly switch with rolling price digits and staggered card reveal.
 *
 * Owner-authorized adaptation of 21st.dev "Pricing Section" (21st:6247).
 * The original `@number-flow/react` odometer and `motion/react` layout spring
 * are reproduced with token-driven CSS transforms so generated sites carry no
 * uncertified runtime packages. All motion collapses under reduced motion.
 */

import React from 'react';
import type { BaseSectionProps, ThemeTokens, PricingTier } from '../../types';
import { hsl, hsla } from '../../themeUtils';
import { PricingFrame, PricingCTA, normalizePricingTiers } from './PricingFrame';

const Check: React.FC<{ color: string }> = ({ color }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 20 20"
    className="mt-0.5 h-4 w-4 shrink-0"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 10.5l4 4 8-9" />
  </svg>
);

/** Splits "$49" into its symbol prefix, numeric amount and trailing suffix. */
export const splitPrice = (price: string): { prefix: string; amount: number | null; suffix: string } => {
  const match = /(-?\d[\d,.]*)/.exec(price || '');
  if (!match) return { prefix: price || '', amount: null, suffix: '' };
  const amount = Number(match[1].replace(/,/g, ''));
  return {
    prefix: price.slice(0, match.index),
    amount: Number.isFinite(amount) ? amount : null,
    suffix: price.slice(match.index + match[1].length),
  };
};

/** Yearly price keeps two months free — the source's "Save 20%" promise. */
export const yearlyAmount = (monthly: number): number => Math.round(monthly * 10);

const RollingPrice: React.FC<{ value: string; yearly: boolean; color: string }> = ({ value, yearly, color }) => (
  <span className="relative inline-flex h-[1.1em] overflow-hidden align-baseline" style={{ color }}>
    <span
      className="flex flex-col transition-transform duration-500 ease-out motion-reduce:transition-none"
      style={{ transform: yearly ? 'translateY(-50%)' : 'translateY(0)' }}
    >
      <span data-ut-slot="pricing.value" className="leading-[1.1em]">{value}</span>
      <span aria-hidden="true" className="leading-[1.1em]">
        {value}
      </span>
    </span>
  </span>
);

const PlanCard: React.FC<{ tier: PricingTier; index: number; theme: ThemeTokens; yearly: boolean }> = ({
  tier,
  index,
  theme,
  yearly,
}) => {
  const { prefix, amount, suffix } = splitPrice(tier.price);
  const shown = amount === null ? tier.price : `${prefix}${yearly ? yearlyAmount(amount) : amount}${suffix}`;
  const period = amount === null ? tier.period : yearly ? 'year' : tier.period || 'month';

  return (
    <div
      data-ut-slot={`plan-${index + 1}`}
      className="flex h-full flex-col p-8 transition-transform duration-300 ease-out hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none"
      style={{
        background: hsl(theme.colors.card),
        color: hsl(theme.colors.cardForeground),
        border: `1px solid ${tier.highlighted ? hsl(theme.colors.primary) : hsla(theme.colors.border, 0.7)}`,
        borderRadius: theme.radius,
        boxShadow: tier.highlighted ? `0 18px 40px -24px ${hsla(theme.colors.primary, 0.6)}` : 'none',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 data-ut-slot={`pricing.name`}
          className="text-2xl"
          style={{ fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight }}
        >
          {tier.name}
        </h3>
        {(tier.badge || tier.highlighted) && (
          <span
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: hsl(theme.colors.primary), color: hsl(theme.colors.primaryForeground) }}
          >
            {tier.badge || 'Popular'}
          </span>
        )}
      </div>

      {tier.description && (
        <p data-ut-slot={`pricing.description`} className="mt-3 text-sm leading-relaxed" style={{ color: hsl(theme.colors.mutedForeground) }}>
          {tier.description}
        </p>
      )}

      <div className="mt-5 flex items-baseline gap-1">
        <span
          className="text-4xl"
          style={{ fontFamily: theme.typography.headingFont, fontWeight: theme.typography.headingWeight }}
        >
          <RollingPrice value={shown} yearly={yearly} color={hsl(theme.colors.cardForeground)} />
        </span>
        {period && (
          <span className="text-sm" style={{ color: hsl(theme.colors.mutedForeground) }}>
            /{period}
          </span>
        )}
      </div>

      <PricingCTA tier={tier} theme={theme} />

      <ul className="mt-6 flex flex-grow flex-col gap-3 p-0" style={{ listStyle: 'none' }}>
        {tier.features.map((feature, f) => (
          <li key={f} className="flex items-start gap-2 text-sm" style={{ fontFamily: theme.typography.bodyFont }}>
            <Check color={hsl(theme.colors.primary)} />
            <span style={{ color: hsl(theme.colors.mutedForeground) }}>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const PricingBillingToggle: React.FC<BaseSectionProps<'pricing'>> = ({ section, theme }) => {
  const { headline, subheadline, tiers } = section.props;
  const plans = normalizePricingTiers(tiers);
  const [yearly, setYearly] = React.useState(false);
  if (!plans.length) return null;

  const pill = (active: boolean) => ({
    background: active ? hsl(theme.colors.primary) : 'transparent',
    color: active ? hsl(theme.colors.primaryForeground) : hsl(theme.colors.mutedForeground),
    borderRadius: '9999px',
  });

  return (
    <PricingFrame variantId="pricing:billing-toggle" theme={theme} headline={headline} subheadline={subheadline}>
      <div className="mb-10 flex justify-center">
        <div
          role="group"
          aria-label="Billing period"
          className="inline-flex gap-1 p-1"
          style={{ background: hsl(theme.colors.card), border: `1px solid ${hsla(theme.colors.border, 0.7)}`, borderRadius: '9999px' }}
        >
          <button
            type="button"
            aria-pressed={!yearly}
            onClick={() => setYearly(false)}
            className="px-6 py-2 text-sm font-medium transition-colors duration-300 motion-reduce:transition-none"
            style={pill(!yearly)}
          >
            Monthly
          </button>
          <button
            type="button"
            aria-pressed={yearly}
            onClick={() => setYearly(true)}
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium transition-colors duration-300 motion-reduce:transition-none"
            style={pill(yearly)}
          >
            Yearly
            <span
              className="rounded-full px-2 py-0.5 text-xs"
              style={{ background: hsla(theme.colors.primary, 0.16), color: hsl(theme.colors.primary) }}
            >
              Save 20%
            </span>
          </button>
        </div>
      </div>

      <div
        className="grid gap-6"
        style={{ gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, minmax(0, 1fr))` }}
      >
        {plans.map((tier, i) => (
          <PlanCard key={i} tier={tier} index={i} theme={theme} yearly={yearly} />
        ))}
      </div>
    </PricingFrame>
  );
};
