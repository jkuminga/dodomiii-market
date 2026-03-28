import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { ProductArtwork } from '../../components/store/ProductArtwork';
import { apiClient, ProductDetail } from '../../lib/api';

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

type DetailTab = 'story' | 'options' | 'policy';

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('story');
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedOrderOptionId, setSelectedOrderOptionId] = useState('');

  useEffect(() => {
    if (!productId) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const result = await apiClient.getProductById(productId);

        if (cancelled) {
          return;
        }

        setProduct(result);
        setSelectedImageIndex(0);
        setActiveTab('story');
        setSelectedOrderOptionId('');
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '상품 상세 조회 중 오류가 발생했습니다.');
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
  }, [productId]);

  if (!productId) {
    return <Navigate to="/products" replace />;
  }

  if (loading) {
    return (
      <main className="m-page detail-page">
        <section className="surface-card status-card">
          <p className="section-kicker">Loading</p>
          <h1 className="section-subtitle">상품 정보를 불러오는 중</h1>
          <p className="feedback-copy">현재 상세 데이터를 가져오고 있습니다.</p>
        </section>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="m-page detail-page">
        <section className="surface-card status-card">
          <p className="section-kicker">Unavailable</p>
          <h1 className="section-subtitle">상품을 표시할 수 없습니다</h1>
          <p className="feedback-copy is-error">{error || '상품 정보가 없습니다.'}</p>
          <Link className="button button-secondary" to="/products">
            목록으로 돌아가기
          </Link>
        </section>
      </main>
    );
  }

  const orderedImages = [...product.images].sort((left, right) => {
    if (left.imageType !== right.imageType) {
      return left.imageType === 'THUMBNAIL' ? -1 : 1;
    }

    return left.sortOrder - right.sortOrder;
  });
  const activeImage = orderedImages[selectedImageIndex] ?? orderedImages[0];
  const activeOptions = [...product.options]
    .filter((option) => option.isActive)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const orderParams = new URLSearchParams();

  if (selectedOrderOptionId) {
    orderParams.set('optionId', selectedOrderOptionId);
  }

  const orderHref = `/products/${product.id}/order${orderParams.toString() ? `?${orderParams.toString()}` : ''}`;

  return (
    <main className="m-page detail-page with-fixed-bar">
      <div className="inline-actions">
        <Link className="button-text" to="/products">
          컬렉션으로 돌아가기
        </Link>
      </div>

      <section className="surface-card detail-media-card">
        <div className="detail-main-media">
          <ProductArtwork src={activeImage?.imageUrl} name={product.name} category={product.categoryName} />
          <div className="detail-media-overlay">
            <span className={`status-pill ${product.isSoldOut ? 'is-muted' : ''}`}>{product.isSoldOut ? '품절' : '판매 중'}</span>
            {product.consultationRequired ? <span className="status-pill">상담 필요</span> : null}
          </div>
        </div>

        {orderedImages.length > 1 ? (
          <div className="detail-thumb-row" aria-label="상품 이미지 선택">
            {orderedImages.map((image, index) => (
              <button
                key={image.id}
                className={`detail-thumb ${index === selectedImageIndex ? 'is-active' : ''}`}
                type="button"
                onClick={() => setSelectedImageIndex(index)}
                aria-label={`${index + 1}번 이미지 보기`}
              >
                <ProductArtwork src={image.imageUrl} name={product.name} category={product.categoryName} />
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="surface-hero compact-hero">
        <p className="section-kicker">{product.categoryName}</p>
        <h1 className="section-title">{product.name}</h1>
        <p className="section-copy">{product.shortDescription ?? product.description ?? '상품 소개 문구가 준비 중입니다.'}</p>

        <div className="detail-price-row">
          <strong className="detail-price">{formatCurrency(product.basePrice)}</strong>
          <span className="detail-stock">{product.stockQuantity === null ? '주문 후 제작' : `남은 수량 ${product.stockQuantity}개`}</span>
        </div>
      </section>

      <section className="surface-card info-stack">
        <div className="benefit-item">
          <span className="benefit-label">배송</span>
          <p>{product.policy.shippingInfo}</p>
        </div>
        <div className="benefit-item">
          <span className="benefit-label">환불</span>
          <p>{product.policy.refundInfo}</p>
        </div>
        <div className="benefit-item">
          <span className="benefit-label">주문 방식</span>
          <p>{product.consultationRequired ? '상담 후 주문이 필요한 상품입니다.' : '현재 화면에서는 상품 정보 확인에 집중했습니다.'}</p>
        </div>
      </section>

      <section className="surface-card detail-order-card">
        <div className="section-head">
          <div>
            <p className="section-kicker">Quick Order</p>
            <h2 className="section-subtitle">주문서로 이어서 입력</h2>
            <p className="section-copy section-copy-compact">상품은 고정하고, 옵션만 골라 주문서로 바로 이동할 수 있게 정리했습니다.</p>
          </div>
          <Link className="button-text" to={orderHref}>
            주문서 열기
          </Link>
        </div>

        {activeOptions.length > 0 ? (
          <label className="field">
            <span>주문서에 미리 담을 옵션</span>
            <select value={selectedOrderOptionId} onChange={(event) => setSelectedOrderOptionId(event.target.value)}>
              <option value="">주문서에서 선택</option>
              {activeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.optionGroupName} / {option.optionValue}
                  {option.extraPrice > 0 ? ` (+${formatCurrency(option.extraPrice)})` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="feedback-copy">추가 옵션이 없는 상품입니다. 주문서에서 수량과 배송지 정보만 입력하면 됩니다.</p>
        )}

        {product.consultationRequired ? (
          <p className="feedback-copy">주문 접수 뒤 상담 확인이 이어질 수 있습니다.</p>
        ) : null}
      </section>

      <section className="surface-card">
        <div className="tab-bar" role="tablist" aria-label="상품 세부 정보">
          <button
            className={`tab-button ${activeTab === 'story' ? 'is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'story'}
            onClick={() => setActiveTab('story')}
          >
            상세정보
          </button>
          <button
            className={`tab-button ${activeTab === 'options' ? 'is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'options'}
            onClick={() => setActiveTab('options')}
          >
            옵션
          </button>
          <button
            className={`tab-button ${activeTab === 'policy' ? 'is-active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === 'policy'}
            onClick={() => setActiveTab('policy')}
          >
            안내
          </button>
        </div>

        <div className="tab-panel">
          {activeTab === 'story' ? (
            <div className="policy-copy">
              <p>{product.description ?? '상품 상세 설명이 아직 등록되지 않았습니다.'}</p>
            </div>
          ) : null}

          {activeTab === 'options' ? (
            activeOptions.length === 0 ? (
              <p className="feedback-copy">등록된 옵션이 없습니다.</p>
            ) : (
              <ul className="option-list">
                {activeOptions.map((option) => (
                  <li className="option-item" key={option.id}>
                    <div>
                      <strong>{option.optionGroupName}</strong>
                      <p>{option.optionValue}</p>
                    </div>
                    <span>{option.extraPrice > 0 ? `+${formatCurrency(option.extraPrice)}` : '추가 금액 없음'}</span>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {activeTab === 'policy' ? (
            <div className="policy-copy">
              <p>{product.policy.shippingInfo}</p>
              <p>{product.policy.refundInfo}</p>
            </div>
          ) : null}
        </div>
      </section>

      <div className="fixed-product-bar">
        <div>
          <p>기본가</p>
          <strong>{formatCurrency(product.basePrice)}</strong>
        </div>
        {product.isSoldOut ? (
          <button className="button" type="button" disabled>
            품절 상품
          </button>
        ) : (
          <Link className="button" to={orderHref}>
            주문서 작성
          </Link>
        )}
      </div>
    </main>
  );
}
