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
            <div className="new-home-product-rail" aria-label="BEST 상품">
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
      <FadeIn direction="up" delay={0}>
        <h2 className="new-home-best-title" id="new-home-all-title">
          <span className="new-home-best-title-text">ALL</span>
        </h2>
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

    const updateResetPoint = () => {
      const railStyle = window.getComputedStyle(rail);
      const gap = Number.parseFloat(railStyle.columnGap || railStyle.gap || '0') || 0;
      resetPoint = firstSet.getBoundingClientRect().width + gap;
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
        rail.scrollLeft += deltaSeconds * ALL_MARQUEE_SPEED_PX_PER_SECOND;

        if (rail.scrollLeft >= resetPoint) {
          rail.scrollLeft -= resetPoint;
        }
      }

      animationFrameId = window.requestAnimationFrame(tick);
    };

    animationFrameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateResetPoint);
    };
  }, [products.length]);

  const setPaused = (isPaused: boolean) => {
    isPausedRef.current = isPaused;
  };

  const renderProducts = (keyPrefix: string, isDuplicate = false) =>
    products.map((product) => (
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
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="new-home-product-marquee-set" ref={firstSetRef}>
        {renderProducts('first')}
        <div className="new-home-marquee-divider" aria-hidden="true" />
      </div>
      <div className="new-home-product-marquee-set" aria-hidden="true">
        {renderProducts('second', true)}
        <div className="new-home-marquee-divider" aria-hidden="true" />
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
