interface UnisonLoadingMarkProps {
  size?: number;
  className?: string;
}

export function UnisonLoadingMark({ size = 40, className = '' }: UnisonLoadingMarkProps) {
  return (
    <img
      src="/unison-icon.png"
      alt=""
      aria-hidden="true"
      className={`block shrink-0 object-contain mix-blend-screen motion-safe:animate-spin motion-reduce:animate-none ${className}`}
      style={{ width: size, height: size, animationDuration: '1.6s' }}
    />
  );
}