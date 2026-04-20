import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { LoadingScreen } from '../../components/common/LoadingScreen';
import { apiClient, ProductDetail } from '../../lib/api';

type KakaoPostcodeAddressData = {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
  address: string;
  userSelectedType: 'R' | 'J';
};

type KakaoPostcodeInstance = {
  open: () => void;
};

type KakaoPostcodeCloseState = 'COMPLETE_CLOSE' | 'FORCE_CLOSE';

type KakaoPostcodeConstructor = new (options: {
  oncomplete: (data: KakaoPostcodeAddressData) => void;
  onclose?: (state: KakaoPostcodeCloseState) => void;
}) => KakaoPostcodeInstance;

declare global {
  interface Window {
    kakao?: {
      Postcode: KakaoPostcodeConstructor;
    };
  }
}

const KAKAO_POSTCODE_SCRIPT_URL = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
let kakaoPostcodeScriptPromise: Promise<void> | null = null;

function loadKakaoPostcodeScript(): Promise<void> {
  if (window.kakao?.Postcode) {
    return Promise.resolve();
  }

  if (kakaoPostcodeScriptPromise) {
    return kakaoPostcodeScriptPromise;
  }

  kakaoPostcodeScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${KAKAO_POSTCODE_SCRIPT_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('주소 검색 스크립트를 불러오지 못했습니다.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = KAKAO_POSTCODE_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('주소 검색 스크립트를 불러오지 못했습니다.'));
    document.head.appendChild(script);
  });

  return kakaoPostcodeScriptPromise;
}

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

type ContactFormState = {
  buyerName: string;
  buyerPhone: string;
  receiverName: string;
  receiverPhone: string;
  zipcode: string;
  address1: string;
  address2: string;
  customerRequest: string;
};

type AddressSelectionState = {
  userSelectedType: 'R' | 'J';
  roadAddress: string;
  jibunAddress: string;
};

const INITIAL_CONTACT_FORM: ContactFormState = {
  buyerName: '',
  buyerPhone: '',
  receiverName: '',
  receiverPhone: '',
  zipcode: '',
  address1: '',
  address2: '',
  customerRequest: '',
};

export function OrderPage() {
  const { productId } = useParams<{ productId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const prefilledSelections = useMemo(() => {
    const raw = searchParams.get('selectedOptions');

    if (!raw) {
      return [];
    }

    return raw
      .split(';')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0)
      .map((segment) => {
        const [groupId, optionId, quantity] = segment.split(':');
        return {
          groupId,
          optionId,
          quantity: Math.max(1, Number(quantity) || 1),
        };
      });
  }, [searchParams]);

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contact, setContact] = useState<ContactFormState>(INITIAL_CONTACT_FORM);
  const [receiverSameAsBuyer, setReceiverSameAsBuyer] = useState(false);
  const [selectedSingleOptionByGroup, setSelectedSingleOptionByGroup] = useState<Record<string, string>>({});
  const [selectedQuantityByOption, setSelectedQuantityByOption] = useState<Record<string, number>>({});
  const [expandedOptionGroups, setExpandedOptionGroups] = useState<Record<string, boolean>>({});
  const [invalidRequiredGroupIds, setInvalidRequiredGroupIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedAddress, setSelectedAddress] = useState<AddressSelectionState | null>(null);
  const [addressSearchActive, setAddressSearchActive] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const optionGroupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!productId) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      setSubmitError('');
      setQuantity(1);
      setContact(INITIAL_CONTACT_FORM);
      setReceiverSameAsBuyer(false);
      setSelectedAddress(null);
      setAddressSearchActive(false);
      setAddressLoading(false);
      setAddressError('');
      setInvalidRequiredGroupIds([]);

      try {
        const result = await apiClient.getProductById(productId);

        if (cancelled) {
          return;
        }

        setProduct(result);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '주문 상품을 불러오는 중 오류가 발생했습니다.');
          setProduct(null);
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
    const nextQuantityByOption: Record<string, number> = {};

    for (const group of optionGroups) {
      if (group.selectionType === 'SINGLE' && group.options.length === 1) {
        nextSingleByGroup[String(group.id)] = String(group.options[0].id);
      }
    }

    for (const selection of prefilledSelections) {
      const group = optionGroups.find((candidate) => String(candidate.id) === selection.groupId);
      if (!group) {
        continue;
      }

      const option = group.options.find((candidate) => String(candidate.id) === selection.optionId);
      if (!option) {
        continue;
      }

      if (group.selectionType === 'SINGLE') {
        nextSingleByGroup[String(group.id)] = String(option.id);
      } else {
        nextQuantityByOption[String(option.id)] =
          option.maxQuantity === null || option.maxQuantity === undefined
            ? selection.quantity
            : Math.min(option.maxQuantity, selection.quantity);
      }
    }

    setSelectedSingleOptionByGroup(nextSingleByGroup);
    setSelectedQuantityByOption(nextQuantityByOption);
    setExpandedOptionGroups((current) => {
      const nextExpanded: Record<string, boolean> = {};
      for (const group of optionGroups) {
        const hasSelected =
          group.selectionType === 'SINGLE'
            ? Boolean(nextSingleByGroup[String(group.id)])
            : group.options.some((option) => (nextQuantityByOption[String(option.id)] ?? 0) > 0);
        nextExpanded[String(group.id)] = current[String(group.id)] ?? (hasSelected || optionGroups.length <= 2);
      }
      return nextExpanded;
    });
  }, [optionGroups, prefilledSelections, product]);

  useEffect(() => {
    if (!receiverSameAsBuyer) {
      return;
    }

    setContact((current) => ({
      ...current,
      receiverName: current.buyerName,
      receiverPhone: current.buyerPhone,
    }));
  }, [receiverSameAsBuyer, contact.buyerName, contact.buyerPhone]);

  if (!productId) {
    return <Navigate to="/products" replace />;
  }

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
  const estimatedUnitPrice = product
    ? product.basePrice + selectedOptionExtraTotal
    : 0;
  const estimatedSubtotal = estimatedUnitPrice * quantity;
  const requiresOptionSelection =
    optionGroups.length > 0 &&
    optionGroups.some((group) => {
      if (!group.isRequired) {
        return false;
      }

      if (group.selectionType === 'SINGLE') {
        return !selectedSingleOptionByGroup[String(group.id)];
      }

      return !group.options.some((option) => (selectedQuantityByOption[String(option.id)] ?? 0) > 0);
    });
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
  const isSubmitDisabled = submitting || !!product?.isSoldOut || requiresOptionSelection;
  const hasSelectedAddress = !!selectedAddress && contact.zipcode.trim().length > 0 && contact.address1.trim().length > 0;

  const onContactChange =
    (field: keyof ContactFormState) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setContact((current) => ({
          ...current,
          [field]: event.target.value,
        }));
      };

  const onQuantityChange = (nextValue: number) => {
    setQuantity(Math.max(1, nextValue));
  };

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

  const onOpenAddressSearch = async () => {
    setAddressLoading(true);
    setAddressSearchActive(false);
    setAddressError('');

    try {
      await loadKakaoPostcodeScript();

      if (!window.kakao?.Postcode) {
        throw new Error('주소 검색 창을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      }

      new window.kakao.Postcode({
        oncomplete: (data) => {
          const selectedType = data.userSelectedType;
          const resolvedAddress =
            selectedType === 'R'
              ? data.roadAddress.trim() || data.address.trim() || data.jibunAddress.trim()
              : data.jibunAddress.trim() || data.address.trim() || data.roadAddress.trim();

          setContact((current) => ({
            ...current,
            zipcode: data.zonecode.trim(),
            address1: resolvedAddress,
          }));
          setSelectedAddress({
            userSelectedType: selectedType,
            roadAddress: data.roadAddress.trim(),
            jibunAddress: data.jibunAddress.trim(),
          });
          setAddressSearchActive(false);
          setAddressError('');
          setSubmitError('');
        },
        onclose: () => {
          setAddressSearchActive(false);
        },
      }).open();

      setAddressSearchActive(true);
    } catch (caught) {
      setAddressSearchActive(false);
      setAddressError(caught instanceof Error ? caught.message : '주소 검색을 열지 못했습니다.');
    } finally {
      setAddressLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!product) {
      return;
    }

    if (requiresOptionSelection) {
      setSubmitError('옵션을 먼저 선택해 주세요.');
      focusFirstMissingRequiredGroup();
      return;
    }

    if (!contact.zipcode.trim() || !contact.address1.trim()) {
      setSubmitError('주소 검색 버튼으로 배송지 정보를 먼저 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const result = await apiClient.createOrder({
        items: [
          {
            productId: product.id,
            selectedOptions:
              selectedOptions.length > 0
                ? selectedOptions.map((entry) => ({
                  productOptionGroupId: entry.group.id,
                  productOptionId: entry.option.id,
                  quantity: entry.quantity,
                }))
                : undefined,
            quantity,
          },
        ],
        contact: {
          buyerName: contact.buyerName.trim(),
          buyerPhone: normalizePhone(contact.buyerPhone),
          receiverName: contact.receiverName.trim(),
          receiverPhone: normalizePhone(contact.receiverPhone),
          zipcode: contact.zipcode.trim(),
          address1: contact.address1.trim(),
          address2: contact.address2.trim() || undefined,
          userSelectedType: selectedAddress?.userSelectedType,
          roadAddress: selectedAddress?.roadAddress || undefined,
          jibunAddress: selectedAddress?.jibunAddress || undefined,
        },
        customerRequest: contact.customerRequest.trim() || undefined,
      });

      navigate(`/orders/${encodeURIComponent(result.orderNumber)}/payment`, {
        state: {
          createdOrder: result,
        },
      });
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : '주문 접수 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="m-page order-page">
        <LoadingScreen title="주문서를 준비하는 중" message="선택한 상품과 주문 입력 화면을 불러오고 있습니다." />
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="m-page order-page">
        <section className="surface-card status-card" role="alert">
          <p className="section-kicker">Unavailable</p>
          <h1 className="section-subtitle">주문서를 열 수 없습니다</h1>
          <p className="feedback-copy is-error">{error || '선택한 상품을 찾지 못했습니다.'}</p>
          <div className="inline-actions order-inline-actions">
            <Link className="button button-secondary" to="/products">
              상품 목록으로
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="m-page order-page">
      <section className="surface-hero compact-hero">
        <p className="section-kicker">Order Form</p>
        <h1 className="section-title order-main-title">주문서 작성</h1>
        <p className="section-copy">
          주문자, 수령인, 배송지 정보를 입력한 뒤 결제 페이지에서 입금 계좌 확인 및 입금 확인 요청을 진행합니다.
        </p>
      </section>

      {product.consultationRequired ? (
        <section className="surface-card order-note-card order-consultation-card">
          <p className="section-kicker">Consultation</p>
          <p className="feedback-copy">이 상품은 상담이 필요한 상품입니다. 주문 접수 후 추가 확인 연락이 이어질 수 있습니다.</p>
        </section>
      ) : null}

      <section className="surface-card order-product-card">
        <div className="order-product-head">
          <div>
            <p className="section-kicker">{product.categoryName}</p>
            <h2 className="section-subtitle">{product.name}</h2>
          </div>
          <span className={`status-pill ${product.isSoldOut ? 'is-muted' : ''}`}>{product.isSoldOut ? '품절' : '주문 가능'}</span>
        </div>

        <div className="order-product-summary">
          <div className="order-summary-row">
            <span>기본가</span>
            <strong>{formatCurrency(product.basePrice)}</strong>
          </div>
          {selectedOptions.length > 0 ? (
            <div className="order-summary-row">
              <span>
                선택 옵션
                {selectedOptions.map((entry) => (
                  <small key={`${entry.group.id}-${entry.option.id}`}>
                    {entry.group.name} / {entry.option.name}
                    {entry.quantity > 1 ? ` x${entry.quantity}` : ''}
                  </small>
                ))}
              </span>
              <strong>
                {selectedOptionExtraTotal > 0
                  ? `+${formatCurrency(selectedOptionExtraTotal)}`
                  : '추가 금액 없음'}
              </strong>
            </div>
          ) : null}
          <div className="order-summary-row">
            <span>예상 상품 금액</span>
            <strong>{formatCurrency(estimatedSubtotal)}</strong>
          </div>
        </div>
      </section>

      <form className="order-form-shell" onSubmit={onSubmit}>
        <section className="surface-card order-form-card">
          <fieldset className="order-form-section">
            <legend>옵션 및 수량</legend>

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
                        {(group.selectionType === 'SINGLE'
                          ? Boolean(selectedSingleOptionByGroup[String(group.id)])
                          : group.options.some((option) => (selectedQuantityByOption[String(option.id)] ?? 0) > 0)) ? (
                          <small className="order-option-selected-flag">선택됨</small>
                        ) : null}
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
                                    name={`option-group-${group.id}`}
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
              <p className="feedback-copy">추가 옵션이 없는 상품입니다. 수량만 조정해서 바로 주문할 수 있습니다.</p>
            )}

            <hr className="order-form-divider" />
            {optionGroups.length > 0 ? (
              <section className="order-option-basket" aria-live="polite">
                <div className="order-option-basket-head">
                  <strong>선택된 옵션</strong>
                  <span>{selectedOptions.length}개 담김</span>
                </div>
                {selectedOptions.length > 0 ? (
                  <ul className="order-option-basket-list">
                    {selectedOptions.map((entry) => (
                      <li key={`${entry.group.id}-${entry.option.id}`} className="order-option-basket-item">
                        <div>
                          <p>{entry.group.name}</p>
                          <strong>
                            {entry.option.name}
                            {entry.quantity > 1 ? ` x${entry.quantity}` : ''}
                          </strong>
                        </div>
                        <div className="order-option-basket-side">
                          <span>
                            {entry.option.extraPrice > 0
                              ? `+${formatCurrency(entry.option.extraPrice * entry.quantity)}`
                              : '+0원'}
                          </span>
                          <button
                            type="button"
                            className="button-text order-option-remove-button"
                            onClick={() => {
                              if (entry.group.selectionType === 'SINGLE') {
                                setSelectedSingleOptionByGroup((current) => ({
                                  ...current,
                                  [String(entry.group.id)]: '',
                                }));
                                return;
                              }

                              setSelectedQuantityByOption((current) => ({
                                ...current,
                                [String(entry.option.id)]: 0,
                              }));
                            }}
                          >
                            제거
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="feedback-copy">옵션을 선택하면 이곳에 담깁니다.</p>
                )}
              </section>
            ) : null}

            {/* <div className="field">
              <span>수량</span>
              <div className="quantity-stepper">
                <button
                  className="quantity-button"
                  type="button"
                  onClick={() => onQuantityChange(quantity - 1)}
                  aria-label="수량 감소"
                  disabled={quantity <= 1}
                >
                  -
                </button>
                <input
                  className="quantity-input"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={quantity}
                  onChange={(event) => onQuantityChange(Number(event.target.value) || 1)}
                />
                <button className="quantity-button" type="button" onClick={() => onQuantityChange(quantity + 1)} aria-label="수량 증가">
                  +
                </button>
              </div>
            </div> */}
          </fieldset>
        </section>

        <section className="surface-card order-form-card">
          <fieldset className="order-form-section">
            <legend>주문인 정보</legend>

            <label className="field">
              <span>주문인 이름</span>
              <input value={contact.buyerName} onChange={onContactChange('buyerName')} placeholder="주문인 이름" required />
            </label>

            <label className="field">
              <span>주문인 연락처</span>
              <input
                value={contact.buyerPhone}
                onChange={onContactChange('buyerPhone')}
                placeholder="-, 공백 없이 입력해주세요"
                inputMode="tel"
                required
              />
            </label>
          </fieldset>
          <hr className="order-form-divider" />

          <fieldset className="order-form-section">
            <legend className="order-section-legend-inline">
              <span>수령인 정보</span>
              <label className="order-inline-checkbox">
                <input
                  type="checkbox"
                  checked={receiverSameAsBuyer}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setReceiverSameAsBuyer(checked);
                    if (checked) {
                      setContact((current) => ({
                        ...current,
                        receiverName: current.buyerName,
                        receiverPhone: current.buyerPhone,
                      }));
                    }
                  }}
                />
                <span>주문자 정보와 동일</span>
              </label>
            </legend>


            <label className="field">
              <span>수령인 이름</span>
              <input
                value={contact.receiverName}
                onChange={onContactChange('receiverName')}
                placeholder="수령인 이름"
                disabled={receiverSameAsBuyer}
                required
              />
            </label>

            <label className="field">
              <span>수령인 연락처</span>
              <input
                value={contact.receiverPhone}
                onChange={onContactChange('receiverPhone')}
                placeholder="-, 공백 없이 입력해주세요"
                inputMode="tel"
                disabled={receiverSameAsBuyer}
                required
              />
            </label>
          </fieldset>
          <hr className="order-form-divider" />
          <fieldset className="order-form-section">
            <legend>배송지 정보</legend>

            <button
              className="order-address-search-button"
              type="button"
              onClick={() => void onOpenAddressSearch()}
              disabled={addressLoading || addressSearchActive}
            >
              배송지 주소 검색
            </button>

            {addressError ? (
              <p className="feedback-copy is-error" role="alert">
                {addressError}
              </p>
            ) : null}

            <label className="field">
              <span>우편번호</span>
              <input value={contact.zipcode} placeholder="주소 검색으로 자동 입력" inputMode="numeric" disabled required />
            </label>

            <label className="field">
              <span>기본 주소</span>
              <input value={contact.address1} placeholder="주소 검색으로 자동 입력" disabled required />
            </label>

            <label className="field">
              <span>상세 주소</span>
              <input
                value={contact.address2}
                onChange={onContactChange('address2')}
                placeholder={hasSelectedAddress ? '상세 주소를 입력해 주세요' : '주소 검색 완료 후 입력 가능'}
                disabled={!hasSelectedAddress}
              />
            </label>
          </fieldset>
          <hr className="order-form-divider" />

          <fieldset className="order-form-section">
            <legend>추가 요청</legend>

            <label className="field">
              <span>요청사항</span>
              <textarea
                value={contact.customerRequest}
                onChange={onContactChange('customerRequest')}
                placeholder="배송 요청사항이나 제작 관련 메모를 남겨 주세요"
                rows={4}
              />
            </label>
          </fieldset>

          {submitError ? (
            <p className="feedback-copy is-error" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="inline-actions order-inline-actions">
            <Link className="button button-secondary" to={`/products/${product.id}`}>
              상품 상세로
            </Link>
            <button className="button" type="submit" disabled={isSubmitDisabled}>
              {product.isSoldOut ? '품절 상품' : submitting ? '주문 생성 중...' : '결제하기'}
            </button>
          </div>
        </section>
      </form>
    </main>
  );
}
