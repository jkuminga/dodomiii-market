import { useRef, useEffect, ReactNode } from 'react';

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

  useEffect(() => {
    let observer: IntersectionObserver;
    const { current } = dom;

    if (current) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && current) {
            current.style.transitionProperty = 'all';
            current.style.transitionDuration = `${duration}s`;
            current.style.transitionTimingFunction = 'cubic-bezier(0, 0, 0.2, 1)';
            current.style.transitionDelay = `${delay}s`;
            current.style.opacity = '1';
            current.style.transform = 'translate3d(0, 0, 0)';
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );
      observer.observe(current);
    }

    return () => observer && observer.disconnect();
  }, [direction, duration, delay]);

  const initialStyle = {
    opacity: 0,
    transform:
      direction === 'up'
        ? 'translate3d(0, 40px, 0)'
        : direction === 'down'
        ? 'translate3d(0, -40px, 0)'
        : direction === 'left'
        ? 'translate3d(40px, 0, 0)'
        : 'translate3d(-40px, 0, 0)',
  };

  return (
    <div ref={dom} style={initialStyle} className={className}>
      {children}
    </div>
  );
}
