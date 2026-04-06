import { useEffect, useRef, useState } from 'react';
import cursorImage from '../../assets/images/cursor-dogs-arrow.png';

const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  '[role="button"]',
  'input',
  'select',
  'textarea',
  'label',
  '[data-cursor="pointer"]',
].join(',');

type AnimatedCursorProps = {
  enabled: boolean;
};

export function AnimatedCursor({ enabled }: AnimatedCursorProps) {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const positionRef = useRef({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);
  const [isFinePointer, setIsFinePointer] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(pointer: fine)').matches : false,
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const pointerQuery = window.matchMedia('(pointer: fine)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handlePointerChange = (event: MediaQueryListEvent) => setIsFinePointer(event.matches);
    const handleReducedMotionChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);

    setIsFinePointer(pointerQuery.matches);
    setPrefersReducedMotion(reducedMotionQuery.matches);
    pointerQuery.addEventListener('change', handlePointerChange);
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);

    return () => {
      pointerQuery.removeEventListener('change', handlePointerChange);
      reducedMotionQuery.removeEventListener('change', handleReducedMotionChange);
    };
  }, []);

  const isCursorActive = enabled && isFinePointer && !prefersReducedMotion;

  useEffect(() => {
    const root = document.documentElement;

    if (!isCursorActive) {
      root.classList.remove('custom-cursor-enabled');
      setIsVisible(false);
      setIsPressed(false);
      setIsInteractive(false);
      return;
    }

    root.classList.add('custom-cursor-enabled');

    const updateCursorPosition = () => {
      frameRef.current = null;
      const cursor = cursorRef.current;
      if (!cursor) {
        return;
      }

      cursor.style.left = `${positionRef.current.x}px`;
      cursor.style.top = `${positionRef.current.y}px`;
    };

    const queueCursorPositionUpdate = () => {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(updateCursorPosition);
    };

    const handleMouseMove = (event: MouseEvent) => {
      positionRef.current = { x: event.clientX, y: event.clientY };
      queueCursorPositionUpdate();
      setIsVisible(true);

      const target = event.target instanceof Element ? event.target : null;
      const nextInteractive = Boolean(target?.closest(INTERACTIVE_SELECTOR));
      setIsInteractive((prev) => (prev === nextInteractive ? prev : nextInteractive));
    };

    const handleMouseDown = () => {
      setIsPressed(true);
    };

    const handleMouseUp = () => {
      setIsPressed(false);
    };

    const handlePointerLeave = () => {
      setIsVisible(false);
      setIsPressed(false);
    };

    const handleWindowBlur = () => {
      setIsVisible(false);
      setIsPressed(false);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('mouseleave', handlePointerLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('mouseleave', handlePointerLeave);

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      frameRef.current = null;
      root.classList.remove('custom-cursor-enabled');
    };
  }, [isCursorActive]);

  if (!isCursorActive) {
    return null;
  }

  const className = [
    'animated-cursor',
    isVisible ? 'is-visible' : '',
    isPressed ? 'is-pressed' : '',
    isInteractive ? 'is-interactive' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} ref={cursorRef} aria-hidden="true">
      <img className="animated-cursor-image" src={cursorImage} alt="" />
    </div>
  );
}
