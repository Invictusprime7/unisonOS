import React, { useState } from 'react';
import type { BaseSectionProps } from '../../types';
import { TestimonialsFrame, TestimonialCard, normalizeTestimonials } from './TestimonialsFrame';

export function TestimonialsColumns({ section, theme }: BaseSectionProps<'testimonials'>) {
  const [playing, setPlaying] = useState(false);
  const items = normalizeTestimonials(section.props.items);
  const count = Math.min(3, Math.max(1, items.length));
  const columns = Array.from({ length: count }, (_, column) => items.filter((_, index) => index % count === column));
  return <TestimonialsFrame variantId="testimonials:columns" theme={theme} headline={section.props.headline} subheadline={section.props.subheadline}>
    <style>{`@keyframes ut-proof-columns{to{transform:translateY(-50%)}}.ut-proof-columns{display:grid;gap:1.5rem}.ut-proof-duplicate{display:none}@media(min-width:768px) and (prefers-reduced-motion:no-preference){[data-proof-playing=true]{max-height:42rem;overflow:hidden}[data-proof-playing=true] .ut-proof-columns{animation:ut-proof-columns 28s linear infinite}[data-proof-playing=true] .ut-proof-duplicate{display:block}[data-proof-playing=true]:hover .ut-proof-columns,[data-proof-playing=true]:focus-within .ut-proof-columns{animation-play-state:paused}}`}</style>
    {items.length > 3 && <button type="button" aria-pressed={playing} onClick={() => setPlaying(value => !value)} className="mb-6 hidden rounded-full border px-4 py-2 text-sm md:inline-flex motion-reduce:hidden">{playing ? 'Pause testimonials' : 'Animate testimonials'}</button>}
    <div data-proof-playing={playing} className="grid gap-6 md:grid-cols-3">
      {columns.map((column, index) => <div key={index} className="min-w-0"><div className="ut-proof-columns">
        {column.map((item, itemIndex) => <div key={itemIndex} data-ut-slot={'testimonial-' + (itemIndex * count + index)}><TestimonialCard item={item} theme={theme}/></div>)}
        {column.map((item, itemIndex) => <div key={'duplicate-' + itemIndex} aria-hidden="true" className="ut-proof-duplicate"><TestimonialCard item={item} theme={theme}/></div>)}
      </div></div>)}
    </div>
  </TestimonialsFrame>;
}
