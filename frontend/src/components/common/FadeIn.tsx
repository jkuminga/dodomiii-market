import { useRef, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';

type Direction = 'up' | 'down' | 'left' | 'right';

type FadeInProps = {
  children: ReactNode;
  direction?: Direction;
  duration?: number;
  delay?: number;
  className?: string;
};

export function FadeIn({ children, direction = 'up', duration = 0.8, delay = 0, className = '' }: FadeInProps) {
  const dom = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  const initialTransform = useMemo(
    () =>
      direction === 'up'
        ? 'translate3d(0, 40px, 0)'
        : direction === 'down'
          ? 'translate3d(0, -40px, 0)'
          : direction === 'left'
            ? 'translate3d(40px, 0, 0)'
            : 'translate3d(-40px, 0, 0)',
    [direction]
  );

  useEffect(() => {
    const { current } = dom;

    if (!current) {
      return undefined;
    }

    if (!('IntersectionObserver' in window)) {
      setIsVisible(true);
      return undefined;
    }

    let observer: IntersectionObserver | null = null;
    let animationFrameId = 0;
    let fallbackTimerId = 0;
    let revealed = false;

    const reveal = () => {
      if (revealed) {
        return;
      }

      revealed = true;
      setIsVisible(true);
      observer?.disconnect();
      window.clearTimeout(fallbackTimerId);
    };

    const revealWhenAlreadyNearViewport = () => {
      const rect = current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const preloadMargin = 180;

      if (
        rect.bottom >= -preloadMargin &&
        rect.right >= -preloadMargin &&
        rect.top <= viewportHeight + preloadMargin &&
        rect.left <= viewportWidth + preloadMargin
      ) {
        reveal();
      }
    };

    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          reveal();
        }
      },
      { rootMargin: '0px 0px 180px 0px', threshold: 0.01 }
    );

    observer.observe(current);
    animationFrameId = window.requestAnimationFrame(revealWhenAlreadyNearViewport);

    // iOS Safari can occasionally miss observer callbacks inside animated/overflowing sections.
    fallbackTimerId = window.setTimeout(reveal, 1800);

    return () => {
      observer?.disconnect();
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(fallbackTimerId);
    };
  }, []);

  const style: CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? 'translate3d(0, 0, 0)' : initialTransform,
    transitionProperty: 'opacity, transform',
    transitionDuration: `${duration}s`,
    transitionTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
    transitionDelay: isVisible ? `${delay}s` : '0s',
  };

  return (
    <div ref={dom} style={style} className={className}>
      {children}
    </div>
  );
}
