/**
 * Testimonials Variant: Rail
 * Horizontal snap rail with keyboard-reachable scroll controls.
 */

import React, { useRef } from 'react';
import type { BaseSectionProps } from '../../types';
import { hsl } from '../../themeUtils';
import { TestimonialsFrame, TestimonialCard, normalizeTestimonials } from './TestimonialsFrame';

export const TestimonialsRail: React.FC<BaseSectionProps<'testimonials'>> = ({ section, theme }) => {
  const items = normalizeTestimonials(section.props.items);
  const railRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(320, rail.clientWidth * 0.8), behavior: 'smooth' });
  };

  const controlStyle: React.CSSProperties = {
    border: `1px solid ${hsl(theme.colors.border)}`,
    color: hsl(theme.colors.foreground),
    borderRadius: theme.radius,
  };

  return (
    <TestimonialsFrame
      variantId="testimonials:rail"
      theme={theme}
      headline={section.props.headline}
      subheadline={section.props.subheadline}
    >
      <div
        ref={railRef}
        className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4"
        role="group"
        aria-label="Customer testimonials"
      >
        {items.map((item, i) => (
          <TestimonialCard
            key={i}
            item={item}
            theme={theme}
            className="w-[var(--ut-carousel-card)] shrink-0 snap-start"
          />
        ))}
      </div>
      {items.length > 1 && (
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => scrollBy(-1)} aria-label="Previous testimonials" className="px-3 py-2 text-sm" style={controlStyle}>
            ←
          </button>
          <button type="button" onClick={() => scrollBy(1)} aria-label="Next testimonials" className="px-3 py-2 text-sm" style={controlStyle}>
            →
          </button>
        </div>
      )}
    </TestimonialsFrame>
  );
};
