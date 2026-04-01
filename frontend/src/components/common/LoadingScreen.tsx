import Lottie from 'lottie-react';

import loadingAnimation from '../../assets/animations/loading-knit.json';

type LoadingScreenProps = {
  title?: string;
  message?: string;
  mode?: 'page' | 'inline';
};

export function LoadingScreen({
  title = '로딩 중',
  message = '잠시만 기다려 주세요.',
  mode = 'page',
}: LoadingScreenProps) {
  if (mode === 'inline') {
    return (
      <div className="loading-screen loading-screen-inline" role="status" aria-live="polite">
        <div className="loading-logo-wrap" aria-hidden="true">
          <Lottie className="loading-lottie" animationData={loadingAnimation} loop autoplay />
        </div>
        <div className="loading-copy">
          <strong>{title}</strong>
          <p>{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="loading-screen-overlay loading-screen-page-only" role="status" aria-live="polite" aria-label={title}>
      <div className="loading-logo-wrap loading-logo-wrap-large" aria-hidden="true">
        <Lottie className="loading-lottie" animationData={loadingAnimation} loop autoplay />
      </div>
    </div>
  );
}
