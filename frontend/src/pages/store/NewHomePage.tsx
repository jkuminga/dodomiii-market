import { useEffect, useState, type ComponentType, type ReactNode } from 'react';

import { LoadingScreen } from '../../components/common/LoadingScreen';
import { ProductTile } from '../../components/store/ProductTile';
import logoSubImage from '../../assets/images/logo_sub.png';
import { apiClient, type ProductListItem } from '../../lib/api';

export type HomePageVariant = 'default' | 'fullWidthContain';

export type HomePageComponentProps = {
  heroLayout?: HomePageVariant;
  categorySectionReplacement?: ReactNode;
};

type NewHomePageProps = {
  HomePageComponent: ComponentType<HomePageComponentProps>;
};

const NEW_HOME_PRODUCT_SIZE = 12;

function NewHomeBestProductsSection() {
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
    <section className="new-home-best-section" aria-labelledby="new-home-best-title">
      <h2 className="new-home-best-title" id="new-home-best-title">
        <img className="new-home-best-logo" src={logoSubImage} alt="" aria-hidden="true" />
        <span className="new-home-best-title-text">BEST</span>
      </h2>

      {loading ? <LoadingScreen mode="inline" title="BEST 상품 로딩 중" message="전체 상품을 불러오고 있습니다." /> : null}
      {error ? <p className="feedback-copy is-error new-home-best-feedback">{error}</p> : null}

      {!loading && !error && products.length === 0 ? (
        <p className="feedback-copy new-home-best-feedback">등록된 상품이 없습니다.</p>
      ) : null}

      {!loading && !error && products.length > 0 ? (
        <div className="new-home-product-rail" aria-label="BEST 전체 상품">
          {products.map((product) => (
            <ProductTile className="new-home-product-tile" key={product.id} product={product} showCategory />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function NewHomePage({ HomePageComponent }: NewHomePageProps) {
  return <HomePageComponent categorySectionReplacement={<NewHomeBestProductsSection />} heroLayout="fullWidthContain" />;
}
