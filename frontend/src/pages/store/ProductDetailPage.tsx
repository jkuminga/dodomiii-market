import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [selectedSingleOptionByGroup, setSelectedSingleOptionByGroup] = useState<Record<string, string>>({});
  const [selectedQuantityByOption, setSelectedQuantityByOption] = useState<Record<string, number>>({});
  const [expandedOptionGroups, setExpandedOptionGroups] = useState<Record<string, boolean>>({});
  const [invalidRequiredGroupIds, setInvalidRequiredGroupIds] = useState<string[]>([]);
  const [showPriceDetails, setShowPriceDetails] = useState(false);
  const optionGroupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Carousel Dragging State
  const [dragStartX, setDragStartX] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

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
        setSelectedSingleOptionByGroup({});
        setSelectedQuantityByOption({});
        setInvalidRequiredGroupIds([]);
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

  const optionGroups = useMemo(
    () =>
      product
        ? [...product.optionGroups]
          .filter((group) => group.isActive)
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((group) => ({
            ...group,
            options: [...group.options]
              .filter((option) => option.isActive)
              .sort((left, right) => left.sortOrder - right.sortOrder),
          }))
        : [],
    [product],
  );

  useEffect(() => {
    if (!product) {
      return;
    }

    const nextSingleByGroup: Record<string, string> = {};

    for (const group of optionGroups) {
      if (group.selectionType === 'SINGLE' && group.options.length === 1) {
        nextSingleByGroup[String(group.id)] = String(group.options[0].id);
      }
    }

    setSelectedSingleOptionByGroup(nextSingleByGroup);
    setSelectedQuantityByOption({});
    setExpandedOptionGroups((current) => {
      const nextExpanded: Record<string, boolean> = {};
      for (const group of optionGroups) {
        const hasSelected = Boolean(nextSingleByGroup[String(group.id)]);
        nextExpanded[String(group.id)] = current[String(group.id)] ?? (hasSelected || optionGroups.length <= 2);
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

    const normalizedIndex = Math.max(0, Math.min(nextIndex, thumbnailImages.length - 1));
    setSelectedImageIndex(normalizedIndex);
    setDragOffset(0); // Reset drag offset on manual navigation
  };

  // Drag Handlers
  const handleDragStart = (clientX: number) => {
    if (thumbnailImages.length <= 1) return;
    setDragStartX(clientX);
    setIsDragging(true);
  };

  const handleDragMove = (clientX: number) => {
    if (dragStartX === null) return;
    const offset = clientX - dragStartX;

    // Resistance at bounds
    if ((selectedImageIndex === 0 && offset > 0) || (selectedImageIndex === thumbnailImages.length - 1 && offset < 0)) {
      setDragOffset(offset * 0.3);
    } else {
      setDragOffset(offset);
    }
  };

  const handleDragEnd = () => {
    if (dragStartX === null) return;

    const threshold = 60; // drag threshold to switch slides
    if (dragOffset > threshold && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    } else if (dragOffset < -threshold && selectedImageIndex < thumbnailImages.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }

    setDragStartX(null);
    setDragOffset(0);
    setIsDragging(false);
  };

  const orderParams = new URLSearchParams();
  const selectedOptions = optionGroups.flatMap((group) => {
    if (group.selectionType === 'SINGLE') {
      const selectedOptionId = selectedSingleOptionByGroup[String(group.id)];
      const option = group.options.find((candidate) => String(candidate.id) === selectedOptionId);
      return option ? [{ group, option, quantity: 1 }] : [];
    }

    return group.options
      .map((option) => ({
        group,
        option,
        quantity: selectedQuantityByOption[String(option.id)] ?? 0,
      }))
      .filter((entry) => entry.quantity > 0);
  });
  const selectedOptionExtraTotal = selectedOptions.reduce(
    (sum, entry) => sum + entry.option.extraPrice * entry.quantity,
    0,
  );
  const selectedTotalPrice = product.basePrice + selectedOptionExtraTotal;
  const missingRequiredGroupIds = optionGroups
    .filter((group) => {
      if (!group.isRequired) {
        return false;
      }

      if (group.selectionType === 'SINGLE') {
        return !selectedSingleOptionByGroup[String(group.id)];
      }

      return !group.options.some((option) => (selectedQuantityByOption[String(option.id)] ?? 0) > 0);
    })
    .map((group) => String(group.id));

  if (selectedOptions.length > 0) {
    orderParams.set(
      'selectedOptions',
      selectedOptions
        .map((entry) => `${entry.group.id}:${entry.option.id}:${entry.quantity}`)
        .join(';'),
    );
  }

  const orderHref = `/products/${product.id}/order${orderParams.toString() ? `?${orderParams.toString()}` : ''}`;
  const focusFirstMissingRequiredGroup = () => {
    if (missingRequiredGroupIds.length === 0) {
      return;
    }

    const [firstMissingGroupId] = missingRequiredGroupIds;
    setInvalidRequiredGroupIds(missingRequiredGroupIds);
    setExpandedOptionGroups((current) => ({
      ...current,
      [firstMissingGroupId]: true,
    }));

    window.requestAnimationFrame(() => {
      optionGroupRefs.current[firstMissingGroupId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  };

  return (
    <main className="m-page detail-page with-fixed-bar">
      {/* <div className="inline-actions">
        <Link className="button-text" to="/products">
          컬렉션으로 돌아가기
        </Link>
      </div> */}

      <div className="detail-media-column">
        <section className="surface-card detail-media-card">
          <div
            className="detail-main-media"
            onDragStart={(e) => e.preventDefault()}
            onMouseDown={(e) => handleDragStart(e.clientX)}
            onMouseMove={(e) => handleDragMove(e.clientX)}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
            onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
            onTouchEnd={handleDragEnd}
          >
            <div
              className={`detail-carousel-track ${isDragging ? 'is-dragging' : ''}`}
              style={{
                transform: `translateX(calc(${-selectedImageIndex * 100}% + ${dragOffset}px))`,
                transition: isDragging ? 'none' : 'transform 0.45s cubic-bezier(0.2, 0, 0.2, 1)',
              }}
            >
              {thumbnailImages.map((image) => (
                <div className="detail-carousel-slide" key={image.id}>
                  <ProductArtwork src={image.imageUrl} name={product.name} category={product.categoryName} />
                </div>
              ))}
              {thumbnailImages.length === 0 && orderedImages.length > 0 && (
                <div className="detail-carousel-slide">
                  <ProductArtwork src={orderedImages[0].imageUrl} name={product.name} category={product.categoryName} />
                </div>
              )}
            </div>

            <div className="detail-media-overlay">
              <span className={`status-pill ${product.isSoldOut ? 'is-muted' : ''}`}>{product.isSoldOut ? '품절' : '판매 중'}</span>
              {product.consultationRequired ? <span className="status-pill">상담 필요</span> : null}
            </div>

            {thumbnailImages.length > 1 ? (
              <>
                <button
                  type="button"
                  className="detail-carousel-nav is-prev"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectImage(selectedImageIndex - 1);
                  }}
                  disabled={selectedImageIndex === 0}
                  aria-label="이전 이미지"
                >
                  <span aria-hidden="true">‹</span>
                </button>
                <button
                  type="button"
                  className="detail-carousel-nav is-next"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectImage(selectedImageIndex + 1);
                  }}
                  disabled={selectedImageIndex === thumbnailImages.length - 1}
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
          </div>

          {optionGroups.length > 0 ? (
            <div className="order-option-group-list">
              {optionGroups.map((group) => (
                <div
                  className="field order-option-group-field"
                  key={group.id}
                  ref={(node) => {
                    optionGroupRefs.current[String(group.id)] = node;
                  }}
                >
                  <div className="order-option-group-head">
                    <span>
                      {group.name}
                      {group.isRequired ? (
                        <small className="order-option-required-flag">필수</small>
                      ) : null}
                      {/* {(group.selectionType === 'SINGLE'
                        ? Boolean(selectedSingleOptionByGroup[String(group.id)])
                        : group.options.some((option) => (selectedQuantityByOption[String(option.id)] ?? 0) > 0)) ? (
                        <small className="order-option-selected-flag">선택됨</small>
                      ) : null} */}
                    </span>
                    <button
                      type="button"
                      className="order-option-toggle"
                      onClick={() =>
                        setExpandedOptionGroups((current) => ({
                          ...current,
                          [String(group.id)]: !(current[String(group.id)] ?? false),
                        }))
                      }
                      aria-expanded={expandedOptionGroups[String(group.id)] ?? false}
                    >
                      {expandedOptionGroups[String(group.id)] ?? false ? '접기' : '펼치기'}
                    </button>
                  </div>
                  {invalidRequiredGroupIds.includes(String(group.id)) ? (
                    <p className="order-option-group-error">하나 이상의 옵션을 선택해 주세요.</p>
                  ) : null}
                  {(expandedOptionGroups[String(group.id)] ?? false) ? (
                    <div className="order-option-multi-list">
                      {group.options.map((option) => {
                        const isSingle = group.selectionType === 'SINGLE';
                        const isChecked = selectedSingleOptionByGroup[String(group.id)] === String(option.id);
                        const quantityValue = selectedQuantityByOption[String(option.id)] ?? 0;

                        return (
                          <label
                            className={`order-option-multi-item ${!isSingle ? 'is-quantity' : ''} ${(isSingle ? isChecked : quantityValue > 0) ? 'is-selected' : ''}`}
                            key={option.id}
                          >
                            {isSingle ? (
                              <>
                                <input
                                  type="radio"
                                  name={`detail-option-group-${group.id}`}
                                  checked={isChecked}
                                  onChange={() => {
                                    setSelectedSingleOptionByGroup((current) => ({
                                      ...current,
                                      [String(group.id)]: String(option.id),
                                    }));
                                    setInvalidRequiredGroupIds((current) =>
                                      current.filter((groupId) => groupId !== String(group.id)),
                                    );
                                  }}
                                />
                                <span>{option.name}</span>
                                <strong>{option.extraPrice > 0 ? `+${formatCurrency(option.extraPrice)}` : '+0원'}</strong>
                              </>
                            ) : (
                              <>
                                <div className="order-option-inline-copy">
                                  <span>{option.name}</span>
                                  <strong>({option.extraPrice > 0 ? `+${formatCurrency(option.extraPrice)}` : '+0원'})</strong>
                                </div>
                                <div className="quantity-stepper">
                                  <button
                                    className="quantity-button"
                                    type="button"
                                    onClick={() => {
                                      setSelectedQuantityByOption((current) => ({
                                        ...current,
                                        [String(option.id)]: Math.max(0, (current[String(option.id)] ?? 0) - 1),
                                      }));
                                      setInvalidRequiredGroupIds((current) =>
                                        current.filter((groupId) => groupId !== String(group.id)),
                                      );
                                    }}
                                    aria-label={`${option.name} 수량 감소`}
                                  >
                                    -
                                  </button>
                                  <input
                                    className="quantity-input"
                                    type="number"
                                    min={0}
                                    max={option.maxQuantity ?? undefined}
                                    step={1}
                                    inputMode="numeric"
                                    value={quantityValue}
                                    onChange={(event) => {
                                      const nextValue = Math.max(0, Number(event.target.value) || 0);
                                      const boundedValue =
                                        option.maxQuantity === null || option.maxQuantity === undefined
                                          ? nextValue
                                          : Math.min(option.maxQuantity, nextValue);
                                      setSelectedQuantityByOption((current) => ({
                                        ...current,
                                        [String(option.id)]: boundedValue,
                                      }));
                                      setInvalidRequiredGroupIds((current) =>
                                        current.filter((groupId) => groupId !== String(group.id)),
                                      );
                                    }}
                                  />
                                  <button
                                    className="quantity-button"
                                    type="button"
                                    onClick={() => {
                                      setSelectedQuantityByOption((current) => {
                                        const nextValue = (current[String(option.id)] ?? 0) + 1;
                                        return {
                                          ...current,
                                          [String(option.id)]:
                                            option.maxQuantity === null || option.maxQuantity === undefined
                                              ? nextValue
                                              : Math.min(option.maxQuantity, nextValue),
                                        };
                                      });
                                      setInvalidRequiredGroupIds((current) =>
                                        current.filter((groupId) => groupId !== String(group.id)),
                                      );
                                    }}
                                    aria-label={`${option.name} 수량 증가`}
                                  >
                                    +
                                  </button>
                                </div>
                              </>
                            )}
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

        <div className={`fixed-product-bar ${showPriceDetails ? 'is-expanded' : ''}`}>
          <div className="fixed-product-bar-container">
            <div className="fixed-product-info" onClick={() => setShowPriceDetails(!showPriceDetails)}>
              <div className="fixed-product-total">
                <div className="total-text-group">
                  <span className="total-label">총 주문 금액</span>
                  <strong className="total-amount">{formatCurrency(selectedTotalPrice)}</strong>
                </div>
                <span className="detail-toggle-icon" aria-hidden="true">
                  ⌃
                </span>
              </div>
            </div>
            <div className="fixed-product-actions">
              {product.isSoldOut ? (
                <button className="button button-block" type="button" disabled>
                  품절된 상품입니다
                </button>
              ) : (
                <Link
                  className="button button-block"
                  to={orderHref}
                  onClick={(event) => {
                    if (missingRequiredGroupIds.length > 0) {
                      event.preventDefault();
                      focusFirstMissingRequiredGroup();
                    }
                  }}
                >
                  주문서 작성하기
                </Link>
              )}
            </div>
          </div>

          <div className="price-breakdown-layer">
            <div className="price-breakdown-content">
              <div className="breakdown-row">
                <span>기본가</span>
                <strong>{formatCurrency(product.basePrice)}</strong>
              </div>
              {selectedOptions.map((entry) => (
                <div className="breakdown-row" key={`${entry.group.id}-${entry.option.id}`}>
                  <span>
                    {entry.group.name}: {entry.option.name}
                    {entry.quantity > 1 ? ` (x${entry.quantity})` : ''}
                  </span>
                  <strong>+{formatCurrency(entry.option.extraPrice * entry.quantity)}</strong>
                </div>
              ))}
            </div>
          </div>
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
                {detailImages.length > 0 ? (
                  <div className="detail-story-images" aria-label="상품 상세 이미지">
                    {detailImages.map((image, index) => (
                      <div className="detail-story-image-frame" key={image.id}>
                        <img
                          className="detail-story-original-image"
                          src={image.imageUrl}
                          alt={`${product.name} 상세 이미지 ${index + 1}`}
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeTab === 'options' ? (
              optionGroups.length === 0 ? (
                <p className="feedback-copy">등록된 옵션이 없습니다.</p>
              ) : (
                <ul className="option-list">
                  {optionGroups.flatMap((group) =>
                    group.options.map((option) => (
                      <li className="option-item" key={option.id}>
                        <div>
                          <strong>{group.name}</strong>
                          <p>
                            {option.name}
                            {group.selectionType === 'QUANTITY' && option.maxQuantity ? ` / 최대 ${option.maxQuantity}개` : ''}
                          </p>
                        </div>
                        <span>{option.extraPrice > 0 ? `+${formatCurrency(option.extraPrice)}` : '추가 금액 없음'}</span>
                      </li>
                    )),
                  )}
                </ul>
              )
            ) : null}

            {activeTab === 'policy' ? (
              <div className="policy-copy">
                <p>{product.description ?? '상품 상세 설명이 아직 등록되지 않았습니다.'}</p>
                <hr style={{ margin: '20px 20px 0 0 ', color: 'gray' }}></hr>
                <p>🚚 {product.policy.shippingInfo}</p>
                <p>🙏 {product.policy.refundInfo}</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>

    </main>
  );
}
