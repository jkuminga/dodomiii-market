import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { LoadingScreen } from '../../components/common/LoadingScreen';
import { FadeIn } from '../../components/common/FadeIn';
import { ProductTile } from '../../components/store/ProductTile';
import { apiClient, type ProductListItem, type StoreHomeItem } from '../../lib/api';

export type HomePageVariant = 'default' | 'fullWidthContain';

export type HomePageComponentProps = {
  heroLayout?: HomePageVariant;
  categorySectionReplacement?: ReactNode;
};

type NewHomePageProps = {
  HomePageComponent: ComponentType<HomePageComponentProps>;
};

const NEW_HOME_PRODUCT_SIZE = 12;
const ALL_MARQUEE_SPEED_PX_PER_SECOND = 34;
const ALL_MARQUEE_TOUCH_RESUME_DELAY_MS = 180;

function NewHomeNewArrivalSection() {
  const [items, setItems] = useState<StoreHomeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const result = await apiClient.getHomeItems('NEW_ARRIVAL');
        if (cancelled) {
          return;
        }

        setItems(result.items);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'New Arrival을 불러오는 중 오류가 발생했습니다.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && !error && items.length === 0) {
    return null;
  }

  return (
    <section className="new-home-arrival-section" aria-labelledby="new-home-arrival-title">
      <FadeIn direction="up" delay={0}>
        <h2 className="new-home-best-title new-home-arrival-title" id="new-home-arrival-title">
          <span className="new-home-best-title-text">NEW ARRIVAL</span>
        </h2>
      </FadeIn>

      {loading ? <LoadingScreen mode="inline" title="새 상품 목록 로딩 중" message="상품 목록을 불러오고 있습니다." /> : null}
      {error ? <p className="feedback-copy is-error new-home-best-feedback">{error}</p> : null}

      {!loading && !error && items.length > 0 ? (
        <FadeIn direction="up" delay={0.15}>
          <div className="new-home-arrival-grid" aria-label="New Arrival 상품">
            {items.slice(0, 1).map((item) => {
              const imageSrc = item.imageUrl || item.product.thumbnailImageUrl;

              return (
                <Link className="new-home-arrival-card" key={item.id} to={`/products/${item.productId}`}>
                  {imageSrc ? <img src={imageSrc} alt={item.title || item.productName} loading="lazy" /> : null}
                </Link>
              );
            })}
          </div>
        </FadeIn>
      ) : null}
    </section>
  );
}

function NewHomeBestItemsSection() {
  const [items, setItems] = useState<StoreHomeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const result = await apiClient.getHomeItems('BEST');
        if (cancelled) {
          return;
        }

        setItems(result.items);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'BEST 상품을 불러오는 중 오류가 발생했습니다.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && !error && items.length === 0) {
    return null;
  }

  return (
    <section className="new-home-best-section new-home-curated-best-section" aria-labelledby="new-home-best-title">
      <FadeIn direction="up" delay={0}>
        <h2 className="new-home-best-title" id="new-home-best-title">
          <span className="new-home-best-title-text">BEST</span>
        </h2>
      </FadeIn>

      {loading ? <LoadingScreen mode="inline" title="추천 상품 로딩 중" message="상품 목록을 불러오고 있습니다." /> : null}
      {error ? <p className="feedback-copy is-error new-home-best-feedback">{error}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <p className="feedback-copy new-home-best-feedback">등록된 베스트 상품이 없습니다.</p>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <FadeIn direction="up" delay={0.15}>
          <div className="new-home-best-mobile-carousel">
            <div
              className={`new-home-product-rail${items.length <= 3 ? ' is-desktop-contained' : ''}`}
              aria-label="BEST 상품"
            >
              {items.map((item) => (
                <ProductTile className="new-home-product-tile" key={item.id} product={item.product} showCategory />
              ))}
            </div>
            {items.length > 1 ? (
              <div className="new-home-best-swipe-hint" aria-hidden="true">
                <span className="new-home-best-swipe-wave is-left">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="new-home-best-swipe-wave is-right">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            ) : null}
          </div>
        </FadeIn>
      ) : null}
    </section>
  );
}

function NewHomeAllProductsSection() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const result = await apiClient.getProducts({ sort: 'latest', size: NEW_HOME_PRODUCT_SIZE });
        if (cancelled) {
          return;
        }

        setProducts(result.items);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '상품 목록을 불러오는 중 오류가 발생했습니다.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="new-home-best-section new-home-all-section" aria-labelledby="new-home-all-title">
      <FadeIn direction="up" delay={0} className="new-home-all-header">
        <h2 className="new-home-best-title" id="new-home-all-title">
          <span className="new-home-best-title-text">ALL</span>
        </h2>
        <Link className="new-home-all-view-link" to="/products" aria-label="전체 상품 보기">
          <span>전체보기</span>
          <span className="new-home-all-view-link-icon" aria-hidden="true">
            ›
          </span>
        </Link>
      </FadeIn>

      {loading ? <LoadingScreen mode="inline" title="상품 로딩 중" message="전체 상품 목록을 불러오고 있습니다." /> : null}
      {error ? <p className="feedback-copy is-error new-home-best-feedback">{error}</p> : null}

      {!loading && !error && products.length === 0 ? (
        <p className="feedback-copy new-home-best-feedback">등록된 상품이 없습니다.</p>
      ) : null}

      {!loading && !error && products.length > 0 ? (
        <FadeIn direction="up" delay={0.15} className="new-home-marquee-frame">
          <NewHomeProductMarquee products={products} />
        </FadeIn>
      ) : null}
    </section>
  );
}

function NewHomeProductMarquee({ products }: { products: ProductListItem[] }) {
  const railRef = useRef<HTMLDivElement>(null);
  const firstSetRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const isTouchScrollingRef = useRef(false);
  const touchResumeTimerRef = useRef<number | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(2);
  const [paintCycle, setPaintCycle] = useState(0);

  useEffect(() => {
    const rail = railRef.current;
    const firstSet = firstSetRef.current;

    if (!rail || !firstSet) {
      return undefined;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }

    let animationFrameId = 0;
    let lastTime = performance.now();
    let resetPoint = 0;
    let virtualScrollLeft = Math.max(0, rail.scrollLeft);
    let lastWrittenScrollLeft = rail.scrollLeft;

    const updateResetPoint = () => {
      const railStyle = window.getComputedStyle(rail);
      const gap = Number.parseFloat(railStyle.columnGap || railStyle.gap || '0') || 0;
      const firstTile = firstSet.querySelector<HTMLElement>('.new-home-product-tile');

      resetPoint = firstSet.getBoundingClientRect().width + gap;

      if (firstTile) {
        const firstSetStyle = window.getComputedStyle(firstSet);
        const tileGap = Number.parseFloat(firstSetStyle.columnGap || firstSetStyle.gap || '0') || 0;
        const tileStep = firstTile.getBoundingClientRect().width + tileGap;
        const nextDuplicateCount = Math.min(
          products.length,
          Math.max(2, Math.ceil(rail.clientWidth / tileStep) + 1),
        );

        setDuplicateCount((currentCount) => (currentCount === nextDuplicateCount ? currentCount : nextDuplicateCount));
      }
    };

    const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(updateResetPoint) : null;

    updateResetPoint();
    resizeObserver?.observe(rail);
    resizeObserver?.observe(firstSet);
    window.addEventListener('resize', updateResetPoint);

    const tick = (time: number) => {
      const deltaSeconds = Math.min((time - lastTime) / 1000, 0.08);
      lastTime = time;

      if (!isPausedRef.current && resetPoint > 0) {
        const actualScrollLeft = Math.max(0, rail.scrollLeft);

        if (Math.abs(actualScrollLeft - lastWrittenScrollLeft) > 1) {
          virtualScrollLeft = actualScrollLeft;
        }

        virtualScrollLeft += deltaSeconds * ALL_MARQUEE_SPEED_PX_PER_SECOND;

        if (virtualScrollLeft >= resetPoint) {
          virtualScrollLeft %= resetPoint;
          setPaintCycle((currentCycle) => currentCycle + 1);
        }

        // Some iOS Safari versions round scrollLeft writes to whole pixels.
        // Keep the fractional position here so sub-pixel movement still accumulates.
        rail.scrollLeft = virtualScrollLeft;
        lastWrittenScrollLeft = rail.scrollLeft;
      }

      animationFrameId = window.requestAnimationFrame(tick);
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateResetPoint);

      if (touchResumeTimerRef.current !== null) {
        window.clearTimeout(touchResumeTimerRef.current);
      }
    };
  }, [paintCycle, products.length]);

  const setPaused = (isPaused: boolean) => {
    isPausedRef.current = isPaused;
  };

  const setPausedForPointer = (event: React.PointerEvent<HTMLDivElement>, isPaused: boolean) => {
    if (event.pointerType === 'mouse') {
      setPaused(isPaused);
    }
  };

  const clearTouchResumeTimer = () => {
    if (touchResumeTimerRef.current !== null) {
      window.clearTimeout(touchResumeTimerRef.current);
      touchResumeTimerRef.current = null;
    }
  };

  const scheduleTouchResume = () => {
    clearTouchResumeTimer();
    touchResumeTimerRef.current = window.setTimeout(() => {
      isTouchScrollingRef.current = false;
      touchResumeTimerRef.current = null;
      setPaused(false);
    }, ALL_MARQUEE_TOUCH_RESUME_DELAY_MS);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse') {
      return;
    }

    clearTouchResumeTimer();
    isTouchScrollingRef.current = true;
    setPaused(true);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') {
      scheduleTouchResume();
    }
  };

  const handleScroll = () => {
    if (isTouchScrollingRef.current) {
      scheduleTouchResume();
    }
  };

  const renderProducts = (items: ProductListItem[], keyPrefix: string, isDuplicate = false) =>
    items.map((product) => (
      <ProductTile
        ariaHidden={isDuplicate}
        className="new-home-product-tile"
        imageLoading="eager"
        key={`${keyPrefix}-${product.id}`}
        product={product}
        showCategory
        tabIndex={isDuplicate ? -1 : undefined}
      />
    ));

  return (
    <div
      className="new-home-product-rail is-marquee"
      ref={railRef}
      aria-label="ALL 전체 상품"
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerEnter={(event) => setPausedForPointer(event, true)}
      onPointerLeave={(event) => setPausedForPointer(event, false)}
      onPointerUp={handlePointerEnd}
      onScroll={handleScroll}
    >
      <div className="new-home-product-marquee-set" key={`paint-cycle-${paintCycle}`} ref={firstSetRef}>
        {renderProducts(products, 'first')}
        <div className="new-home-marquee-divider" aria-hidden="true" />
      </div>
      <div className="new-home-product-marquee-set" aria-hidden="true">
        {renderProducts(products.slice(0, duplicateCount), 'duplicate', true)}
      </div>
    </div>
  );
}

export function NewHomePage({ HomePageComponent }: NewHomePageProps) {
  return (
    <HomePageComponent
      categorySectionReplacement={
        <>
          <div className="new-home-featured-row">
            <NewHomeNewArrivalSection />
            <NewHomeBestItemsSection />
          </div>
          <NewHomeAllProductsSection />
        </>
      }
      heroLayout="fullWidthContain"
    />
  );
}
