/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { cn } from '../cn';
import { ChevronLeft, ChevronRight } from '../icons';

type EmblaApi = ReturnType<typeof useEmblaCarousel>[1];

const CarouselContext = React.createContext<{ api: EmblaApi } | null>(null);

export function Carousel({ className, children, loop = true, ...props }: React.HTMLAttributes<HTMLDivElement> & { loop?: boolean }) {
  const [ref, api] = useEmblaCarousel({ loop, align: 'start' });
  return (
    <CarouselContext.Provider value={{ api }}>
      <div className={cn('relative', className)} role="region" aria-roledescription="carousel" {...props}>
        <div ref={ref} className="overflow-hidden">{children}</div>
      </div>
    </CarouselContext.Provider>
  );
}

export function CarouselContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex gap-[var(--ut-stack-gap)]', className)} {...props} />;
}

export function CarouselItem({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="group" aria-roledescription="slide" className={cn('min-w-0 shrink-0 grow-0 basis-full sm:basis-1/2 lg:basis-1/3', className)} {...props} />;
}

function NavButton({ label, onClick, className, children }: { label: string; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn('absolute top-1/2 z-10 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
    >
      {children}
    </button>
  );
}

export function CarouselPrevious({ className }: { className?: string }) {
  const context = React.useContext(CarouselContext);
  return <NavButton label="Previous slide" className={cn('left-2', className)} onClick={() => context?.api?.scrollPrev()}><ChevronLeft /></NavButton>;
}

export function CarouselNext({ className }: { className?: string }) {
  const context = React.useContext(CarouselContext);
  return <NavButton label="Next slide" className={cn('right-2', className)} onClick={() => context?.api?.scrollNext()}><ChevronRight /></NavButton>;
}
