/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
  import { motion, useReducedMotion, useScroll, useTransform } from './animation';
import { Image } from './media';
import { cn } from './cn';
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Layout = __LucideIcons['Layout'] || __LucideFallback;

export type MotionRecipe = 'editorial-reveal' | 'product-focus' | 'service-progressive-disclosure' | 'proof-led-stagger' | 'gallery-inspection' | 'conversion-feedback';

const recipeOffset: Record<MotionRecipe, number> = {
  'editorial-reveal': 20,
  'product-focus': 14,
  'service-progressive-disclosure': 16,
  'proof-led-stagger': 12,
  'gallery-inspection': 10,
  'conversion-feedback': 8,
};

export function Reveal({ children, className, recipe = 'editorial-reveal' }: { children: React.ReactNode; className?: string; recipe?: MotionRecipe }) {
  const reduceMotion = useReducedMotion();
  const offset = reduceMotion ? 0 : recipeOffset[recipe];
  return <motion.div className={cn(className)} initial={{ opacity: reduceMotion ? 1 : 0, y: offset }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0 }} transition={{ duration: reduceMotion ? 0 : 0.45, ease: 'easeOut' }}>{children}</motion.div>;
}

export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  // Layout-transparent by default: a wrapper div here would collapse every card
  // into the first cell of a parent grid/flex row (fragmented, left-glued pages).
  if (!className) return <>{children}</>;
  return <motion.div className={cn(className)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.12 }} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09 } } }}>{children}</motion.div>;
}

export function RevealGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Stagger className={className}>{children}</Stagger>;
}

// Naming synonyms accepted by the facade so a generated page never fails on
// vocabulary alone. Behaviourally identical to Stagger.
export function StaggerGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Stagger className={className}>{children}</Stagger>;
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  // Self-animating so items still reveal when Stagger is layout-transparent.
  return <motion.div className={cn('h-full', className)} initial={{ opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' }} variants={{ hidden: { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 12 }, show: { opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' } } }}>{children}</motion.div>;
}

// ────────────────────────────────────────────────────────────────
// Lane B Motion Primitives — expanded foundation for visual richness
// All primitives honor useReducedMotion() and use Stage 4b tokens.
// ────────────────────────────────────────────────────────────────

export interface MarqueeBandProps {
  children: React.ReactNode;
  className?: string;
  speed?: 'slow' | 'normal' | 'fast';
  direction?: 'left' | 'right';
  pauseOnHover?: boolean;
}

export function MarqueeBand({ children, className, speed = 'normal', direction = 'left', pauseOnHover = true }: MarqueeBandProps) {
  const reduceMotion = useReducedMotion();
  const speedMap = { slow: 60, normal: 40, fast: 20 };
  const duration = speedMap[speed];
  
  return (
    <div className={cn('group relative overflow-hidden', className)}>
      <motion.div
        initial={{ x: 0 }}
        animate={reduceMotion ? { x: 0 } : { x: direction === 'left' ? '-50%' : '50%' }}
        transition={{ duration: reduceMotion ? 0 : duration, repeat: Infinity, ease: 'linear' }}
        whileHover={pauseOnHover && !reduceMotion ? { animationPlayState: 'paused' } : undefined}
        className="flex w-max whitespace-nowrap gap-[var(--ut-section-space)]"
      >
        {children}
        {children}
      </motion.div>
    </div>
  );
}

export interface HorizontalRailProps {
  children: React.ReactNode;
  className?: string;
}

export function HorizontalRail({ children, className }: HorizontalRailProps) {
  const reduceMotion = useReducedMotion();
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  return (
    <div ref={containerRef} className={cn('group relative overflow-x-auto scrollbar-hide', className)}>
      <div className="flex gap-[var(--ut-block)] pb-4">
        {React.Children.map(children, (child, i) => (
          <motion.div
            key={i}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: 20 }}
            whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: reduceMotion ? 0 : 0.35, delay: i * 0.05, ease: 'easeOut' }}
            className="flex-shrink-0"
          >
            {child}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export interface HoverDepthProps {
  children: React.ReactNode;
  className?: string;
  scale?: number;
  liftAmount?: number;
}

export function HoverDepth({ children, className, scale = 1.02, liftAmount = 8 }: HoverDepthProps) {
  const reduceMotion = useReducedMotion();
  
  return (
    <motion.div
      className={className}
      initial={{ y: 0, scale: 1 }}
      whileHover={reduceMotion ? undefined : { y: -liftAmount, scale }}
      transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export interface ImageRevealProps {
  src: string;
  alt: string;
  className?: string;
  ratio?: string;
}

export function ImageReveal({ src, alt, className, ratio = '4/3' }: ImageRevealProps) {
  const reduceMotion = useReducedMotion();
  
  return (
    <motion.div
      className={cn('relative overflow-hidden rounded-[var(--radius)]', className)}
      style={{ aspectRatio: ratio }}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: reduceMotion ? 0 : 0.6, ease: 'easeOut' }}
    >
      <motion.img
        src={src}
        alt={alt}
        className="h-full w-full object-cover"
        initial={reduceMotion ? { scale: 1 } : { scale: 1.1 }}
        whileInView={reduceMotion ? { scale: 1 } : { scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.8, ease: 'easeOut' }}
      />
    </motion.div>
  );
}

export interface ParallaxMediaProps {
  children: React.ReactNode;
  className?: string;
  offset?: number;
}

export function ParallaxMedia({ children, className, offset = 50 }: ParallaxMediaProps) {
  const reduceMotion = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 1000], [0, offset]);
  
  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ y }}
    >
      {children}
    </motion.div>
  );
}

export interface MaskRevealProps {
  children: React.ReactNode;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export function MaskReveal({ children, className, direction = 'up' }: MaskRevealProps) {
  const reduceMotion = useReducedMotion();
  
  const directionMap = {
    up: { x: 0, y: 40 },
    down: { x: 0, y: -40 },
    left: { x: 40, y: 0 },
    right: { x: -40, y: 0 },
  };
  
  return (
    <motion.div
      className={cn('overflow-hidden', className)}
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, ...directionMap[direction] }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: reduceMotion ? 0 : 0.5, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

export interface MotionImageProps {
  src: string;
  alt: string;
  className?: string;
  animationType?: 'reveal' | 'zoom' | 'shift';
  ratio?: string;
}

export function MotionImage({ src, alt, className, animationType = 'reveal', ratio = '4/3' }: MotionImageProps) {
  const reduceMotion = useReducedMotion();
  
  const animations = {
    reveal: {
      initial: reduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 },
      whileInView: reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
    },
    zoom: {
      initial: reduceMotion ? { scale: 1 } : { scale: 0.9, opacity: 0 },
      whileInView: reduceMotion ? { scale: 1 } : { scale: 1, opacity: 1 },
    },
    shift: {
      initial: reduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 },
      whileInView: reduceMotion ? { opacity: 1, x: 0 } : { opacity: 1, x: 0 },
    },
  };
  
  return (
    <motion.div
      className={cn('overflow-hidden rounded-[var(--radius)]', className)}
      style={{ aspectRatio: ratio }}
      initial={animations[animationType].initial}
      whileInView={animations[animationType].whileInView}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: reduceMotion ? 0 : 0.5, ease: 'easeOut' }}
    >
      <Image src={src} alt={alt} className="h-full w-full object-cover" />
    </motion.div>
  );
}
