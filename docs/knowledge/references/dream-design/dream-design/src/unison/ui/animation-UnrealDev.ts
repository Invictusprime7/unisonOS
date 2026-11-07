/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */
// UNISON GENERATED UI FOUNDATION v1.12
import * as React from 'react';
import * as __FramerMotion from '../../motion-shim';
const __motionFallback = typeof Proxy !== 'undefined' ? new Proxy({}, { get: (_, tag) => (props) => React.createElement(String(tag), Object.fromEntries(Object.entries(props || {}).filter(([k]) => !k.startsWith('while') && !k.startsWith('animate') && !k.startsWith('initial') && !k.startsWith('exit') && !k.startsWith('transition') && !k.startsWith('variants') && k !== 'layout' && k !== 'layoutId'))) }) : {};
const __AnimatePresenceFallback = ({ children }) => React.createElement(React.Fragment, null, children);
const motion = __FramerMotion['motion'] || __motionFallback;
const useReducedMotion = __FramerMotion['useReducedMotion'] || (() => null);
import * as __LucideIcons from 'lucide-react';
const __LucideFallback = (props) => React.createElement('svg', Object.assign({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, props), React.createElement('circle', { cx: 12, cy: 12, r: 10 }), React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }), React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 }));
const Layout = __LucideIcons['Layout'] || __LucideFallback;

export * from '../../motion-shim';

type StaggerProps = { children: React.ReactNode; className?: string };

/**
 * Compatibility aliases for pre-foundation generated pages.
 * These MUST stay behaviourally identical to /src/unison/ui/motion.tsx:
 * a container that renders its own <div> inside a parent grid collapses every
 * child into the first cell. Layout-transparent unless it owns classes.
 */
export function StaggerContainer({ children, className }: StaggerProps) {
  const reduceMotion = useReducedMotion();
  if (!className) return React.createElement(React.Fragment, null, children);
  return React.createElement(motion.div, {
    className,
    initial: 'hidden',
    whileInView: 'show',
    viewport: { once: true, amount: 0.12 },
    variants: { hidden: {}, show: { transition: { staggerChildren: reduceMotion ? 0 : 0.09 } } },
  }, children);
}

export function StaggerChild({ children, className }: StaggerProps) {
  const reduceMotion = useReducedMotion();
  const reveal = { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 12 };
  const shown = { opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' } };
  // Self-animating so items still reveal when the container is transparent.
  return React.createElement(motion.div, {
    className,
    initial: reveal,
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.15 },
    transition: { duration: reduceMotion ? 0 : 0.35, ease: 'easeOut' },
    variants: { hidden: reveal, show: shown },
  }, children);
}

export const Stagger = StaggerContainer;
export const StaggerItem = StaggerChild;
export const RevealGroup = StaggerContainer;
export const StaggerGroup = StaggerContainer;
