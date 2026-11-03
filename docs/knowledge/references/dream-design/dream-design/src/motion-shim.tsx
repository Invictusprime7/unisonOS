
import React from 'react';

const MOTION_ONLY_PROPS = new Set([
  'animate', 'initial', 'exit', 'transition', 'variants', 'whileHover',
  'whileTap', 'whileFocus', 'whileInView', 'layout', 'layoutId', 'drag',
  'dragConstraints', 'onAnimationStart', 'onAnimationComplete',
]);
const component = (tag = 'div') => React.forwardRef(({ children, ...props }, ref) => {
  const domProps = Object.fromEntries(
    Object.entries(props).filter(([name]) => !MOTION_ONLY_PROPS.has(name))
  );
  return React.createElement(tag, { ...domProps, ref }, children);
});
const motionComponent = (tag) => component(String(tag));
export const motion = new Proxy({}, { get: (_target, tag) => motionComponent(tag) });
export const m = motion;
export const AnimatePresence = ({ children }) => React.createElement(React.Fragment, null, children);
export const LazyMotion = AnimatePresence;
export const LayoutGroup = AnimatePresence;
export const MotionConfig = AnimatePresence;
export const Reorder = { Group: component(), Item: component() };
export const useMotionValue = (initial) => {
  const value = React.useRef(initial);
  return React.useMemo(() => ({ get: () => value.current, set: (next) => { value.current = next; }, on: () => () => {} }), []);
};
export const useSpring = (value) => value;
export const useTransform = (value) => value;
export const useScroll = () => ({ scrollX: useMotionValue(0), scrollY: useMotionValue(0), scrollXProgress: useMotionValue(0), scrollYProgress: useMotionValue(0) });
export const useInView = () => true;
export const useAnimation = () => ({ start: () => Promise.resolve(), set: () => {}, stop: () => {} });
export const useReducedMotion = () => false;
