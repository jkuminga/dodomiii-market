import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { LoadingScreen } from '../../components/common/LoadingScreen';
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
  const [selectedOrderOptionByGroup, setSelectedOrderOptionByGroup] = useState<Record<string, string[]>>({});
  const [expandedOptionGroups, setExpandedOptionGroups] = useState<Record<string, boolean>>({});

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
        setSelectedOrderOptionByGroup({});
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

  const activeOptions = useMemo(
    () =>
      product
        ? [...product.options]
            .filter((option) => option.isActive)
            .sort((left, right) => left.sortOrder - right.sortOrder)
        : [],
    [product],
  );

  const optionGroups = useMemo(() => {
    const grouped = new Map<string, typeof activeOptions>();

    for (const option of activeOptions) {
      const current = grouped.get(option.optionGroupName) ?? [];
      current.push(option);
      grouped.set(option.optionGroupName, current);
    }

    return [...grouped.entries()].map(([groupName, options]) => ({
      groupName,
      options,
    }));
  }, [activeOptions]);

  useEffect(() => {
    if (!product) {
      return;
    }

    const nextByGroup: Record<string, string[]> = {};

    for (const group of optionGroups) {
      nextByGroup[group.groupName] = group.options.length === 1 ? [String(group.options[0].id)] : [];
    }

    setSelectedOrderOptionByGroup(nextByGroup);
    setExpandedOptionGroups((current) => {
      const nextExpanded: Record<string, boolean> = {};
      for (const group of optionGroups) {
        const hasSelected = (nextByGroup[group.groupName] ?? []).length > 0;
        nextExpanded[group.groupName] = current[group.groupName] ?? (hasSelected || optionGroups.length <= 2);
      }
      return nextExpanded;
    });
  }, [optionGroups, product]);

  if (!productId) {
    return <Navigate to="/products" replace />;
  }

  if (loading) {
    return (
      <main className="m-page detail-page">
        <LoadingScreen title="상품 정보를 불러오는 중" message="현재 상세 데이터를 가져오고 있습니다." />
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
  const thumbnailImages = orderedImages.filter((image) => image.imageType === 'THUMBNAIL');
  const detailImages = orderedImages.filter((image) => image.imageType === 'DETAIL');
  const activeImage = thumbnailImages[selectedImageIndex] ?? thumbnailImages[0] ?? orderedImages[0];
  const selectedThumbnailIndex =
    thumbnailImages.length === 0 ? 0 : Math.min(selectedImageIndex, Math.max(thumbnailImages.length - 1, 0));

  const handleSelectImage = (nextIndex: number) => {
    if (thumbnailImages.length === 0) {
      return;
    }

    const normalizedIndex = ((nextIndex % thumbnailImages.length) + thumbnailImages.length) % thumbnailImages.length;
    setSelectedImageIndex(normalizedIndex);
  };

  const orderParams = new URLSearchParams();
  const selectedOptionIdSet = new Set(
    optionGroups
      .flatMap((group) => (selectedOrderOptionByGroup[group.groupName] ?? []).map((value) => Number(value)))
      .filter((value) => Number.isFinite(value)),
  );
  const selectedOptionIds = [...selectedOptionIdSet];
  const selectedOptions = selectedOptionIds
    .map((optionId) => activeOptions.find((option) => option.id === optionId) ?? null)
    .filter((option): option is NonNullable<typeof option> => option !== null);
  const selectedOptionExtraTotal = selectedOptions.reduce((sum, option) => sum + option.extraPrice, 0);
  const selectedTotalPrice = product.basePrice + selectedOptionExtraTotal;

  if (selectedOptionIds.length > 0) {
    orderParams.set('optionIds', selectedOptionIds.join(','));
  }

  const orderHref = `/products/${product.id}/order${orderParams.toString() ? `?${orderParams.toString()}` : ''}`;

  return (
    <main className="m-page detail-page with-fixed-bar">
      {/* <div className="inline-actions">
        <Link className="button-text" to="/products">
          컬렉션으로 돌아가기
        </Link>
      </div> */}

      <div className="detail-media-column">
        <section className="surface-card detail-media-card">
          <div className="detail-main-media">
            <ProductArtwork src={activeImage?.imageUrl} name={product.name} category={product.categoryName} />
            <div className="detail-media-overlay">
              <span className={`status-pill ${product.isSoldOut ? 'is-muted' : ''}`}>{product.isSoldOut ? '품절' : '판매 중'}</span>
              {product.consultationRequired ? <span className="status-pill">상담 필요</span> : null}
            </div>

            {thumbnailImages.length > 1 ? (
              <>
                <button
                  type="button"
                  className="detail-carousel-nav is-prev"
                  onClick={() => handleSelectImage(selectedThumbnailIndex - 1)}
                  aria-label="이전 이미지"
                >
                  <span aria-hidden="true">‹</span>
                </button>
                <button
                  type="button"
                  className="detail-carousel-nav is-next"
                  onClick={() => handleSelectImage(selectedThumbnailIndex + 1)}
                  aria-label="다음 이미지"
                >
                  <span aria-hidden="true">›</span>
                </button>
              </>
            ) : null}
          </div>

          {thumbnailImages.length > 1 ? (
            <div className="detail-thumb-row" aria-label="상품 이미지 선택">
              {thumbnailImages.map((image, index) => (
                <button
                  key={image.id}
                  className={`detail-thumb ${index === selectedThumbnailIndex ? 'is-active' : ''}`}
                  type="button"
                  onClick={() => handleSelectImage(index)}
                  aria-label={`${index + 1}번 이미지 보기`}
                >
                  <ProductArtwork src={image.imageUrl} name={product.name} category={product.categoryName} />
                </button>
              ))}
            </div>
          ) : null}

          {thumbnailImages.length > 1 ? (
            <div className="detail-carousel-indicators" aria-hidden="true">
              {thumbnailImages.map((image, index) => (
                <span key={image.id} className={`detail-carousel-dot ${index === selectedThumbnailIndex ? 'is-active' : ''}`} />
              ))}
            </div>
          ) : null}
        </section>
      </div>

      <div className="detail-side-column">
        <section className="surface-hero compact-hero detail-summary-card">
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
              <p className="section-kicker">Options</p>
              <h2 className="section-subtitle">옵션 선택</h2>
              <p className="section-copy section-copy-compact">원하시는 옵션을 선택하세요.</p>
            </div>
            <Link className="button-text" to={orderHref}>
              주문서 열기
            </Link>
          </div>

          {activeOptions.length > 0 ? (
            <div className="order-option-group-list">
              {optionGroups.map((group) => (
                <div className="field order-option-group-field" key={group.groupName}>
                  <div className="order-option-group-head">
                    <span>
                      {group.groupName}
                      {(selectedOrderOptionByGroup[group.groupName] ?? []).length > 0 ? (
                        <small className="order-option-selected-flag">선택됨</small>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="order-option-toggle"
                      onClick={() =>
                        setExpandedOptionGroups((current) => ({
                          ...current,
                          [group.groupName]: !(current[group.groupName] ?? false),
                        }))
                      }
                      aria-expanded={expandedOptionGroups[group.groupName] ?? false}
                    >
                      {expandedOptionGroups[group.groupName] ?? false ? '접기' : '펼치기'}
                    </button>
                  </div>
                  {(expandedOptionGroups[group.groupName] ?? false) ? (
                    <div className="order-option-multi-list">
                      {group.options.map((option) => {
                        const selectedValues = selectedOrderOptionByGroup[group.groupName] ?? [];
                        const isChecked = selectedValues.includes(String(option.id));

                        return (
                          <label className={`order-option-multi-item ${isChecked ? 'is-selected' : ''}`} key={option.id}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(event) =>
                                setSelectedOrderOptionByGroup((current) => {
                                  const previous = current[group.groupName] ?? [];
                                  const next = event.target.checked
                                    ? [...previous, String(option.id)]
                                    : previous.filter((value) => value !== String(option.id));

                                  return {
                                    ...current,
                                    [group.groupName]: [...new Set(next)],
                                  };
                                })
                              }
                            />
                            <span>{option.optionValue}</span>
                            <strong>{option.extraPrice > 0 ? `+${formatCurrency(option.extraPrice)}` : '+0원'}</strong>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="feedback-copy">추가 옵션이 없는 상품입니다. 주문서에서 수량과 배송지 정보만 입력하면 됩니다.</p>
          )}

          {product.consultationRequired ? (
            <p className="feedback-copy">주문 접수 뒤 상담 확인이 이어질 수 있습니다.</p>
          ) : null}
        </section>

        <div className="fixed-product-bar">
          <div>
            <p>총액</p>
            <strong>{formatCurrency(selectedTotalPrice)}</strong>
          </div>
          {product.isSoldOut ? (
            <button className="button" type="button" disabled>
              품절 상품
            </button>
          ) : (
            <Link className="button" to={orderHref}>
              주문서 이동
            </Link>
          )}
        </div>
      </div>

      <div className="detail-tab-column">
        <section className="surface-card detail-tab-card">
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
              {detailImages.length > 0 ? (
                <div className="detail-story-images" aria-label="상품 상세 이미지">
                  {detailImages.map((image, index) => (
                    <div className="detail-story-image-frame" key={image.id}>
                      <ProductArtwork
                        src={image.imageUrl}
                        name={`${product.name} 상세 이미지 ${index + 1}`}
                        category={product.categoryName}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
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
      </div>

    </main>
  );
}
