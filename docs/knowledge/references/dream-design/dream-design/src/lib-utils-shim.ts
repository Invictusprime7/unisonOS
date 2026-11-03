
export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
export function clsx(...args) {
  return args.flat(Infinity).filter(x => typeof x === 'string' && x).join(' ');
}
export default { cn, clsx };
