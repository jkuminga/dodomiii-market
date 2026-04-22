import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { apiClient } from '../../lib/api';
import { calculateCartItemUnitPrice, clearCart, useCart } from '../../lib/cart';

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

export function CartOrderPage() {
  const navigate = useNavigate();
  const { items, itemCount } = useCart();
  const [contact, setContact] = useState<ContactFormState>(INITIAL_CONTACT_FORM);
  const [receiverSameAsBuyer, setReceiverSameAsBuyer] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<AddressSelectionState | null>(null);
  const [addressSearchActive, setAddressSearchActive] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const totalProductPrice = items.reduce((sum, item) => sum + calculateCartItemUnitPrice(item) * item.productQuantity, 0);
  const shippingFee = items.length > 0 ? 3000 : 0;
  const estimatedFinalPrice = totalProductPrice + shippingFee;
  const hasSelectedAddress = !!selectedAddress && contact.zipcode.trim().length > 0 && contact.address1.trim().length > 0;

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

  const onContactChange =
    (field: keyof ContactFormState) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setContact((current) => ({
          ...current,
          [field]: event.target.value,
        }));
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

    if (items.length === 0) {
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
        items: items.map((item) => ({
          productId: item.productId,
          selectedOptions:
            item.selectedOptions.length > 0
              ? item.selectedOptions.map((option) => ({
                productOptionGroupId: option.groupId,
                productOptionId: option.optionId,
                quantity: option.quantity,
              }))
              : undefined,
          quantity: item.productQuantity,
        })),
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

      clearCart();
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

  if (items.length === 0) {
    return (
      <main className="m-page order-page">
        <section className="surface-card status-card" role="alert">
          <p className="section-kicker">Empty Cart</p>
          <h1 className="section-subtitle">주문할 장바구니 상품이 없습니다</h1>
          <p className="feedback-copy">상품을 먼저 장바구니에 담아 주세요.</p>
          <div className="inline-actions order-inline-actions">
            <Link className="button button-secondary" to="/cart">
              장바구니로
            </Link>
            <Link className="button" to="/products">
              상품 보러가기
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="m-page order-page">
      <section className="surface-hero compact-hero">
        <p className="section-kicker">Cart Order</p>
        <h1 className="section-title order-main-title">주문하기</h1>
      </section>

      <section className="surface-card order-product-card">
        <div className="order-product-head">
          <div>
            <p className="section-kicker">Order Items</p>
            <h2 className="section-subtitle">담은 상품 {itemCount}개</h2>
          </div>
          <span className="status-pill">한 번에 주문</span>
        </div>

        <div className="order-cart-item-list">
          {items.map((item) => {
            const unitPrice = calculateCartItemUnitPrice(item);
            const lineTotalPrice = unitPrice * item.productQuantity;

            return (
              <div className="order-cart-item" key={item.id}>
                <div className="order-cart-item-copy">
                  <strong>{item.productName}</strong>
                  <span>
                    {item.categoryName} / 수량 {item.productQuantity}개
                  </span>
                  {item.selectedOptions.length > 0 ? (
                    <div className="order-cart-option-lines">
                      {item.selectedOptions.map((option) => (
                        <small key={`${item.id}-${option.groupId}-${option.optionId}`}>
                          {option.groupName} ({option.optionName}
                          {option.quantity > 1 ? ` x${option.quantity}` : ''}) {option.extraPrice > 0 ? `+${formatCurrency(option.extraPrice * option.quantity)}` : '+0원'}
                        </small>
                      ))}
                    </div>
                  ) : (
                    <small>선택 옵션 없음</small>
                  )}
                </div>
                <strong>{formatCurrency(lineTotalPrice)}</strong>
              </div>
            );
          })}
        </div>

        <div className="order-product-summary">
          <div className="order-summary-row">
            <span>상품 금액</span>
            <strong>{formatCurrency(totalProductPrice)}</strong>
          </div>
          <div className="order-summary-row">
            <span>배송비</span>
            <strong>{formatCurrency(shippingFee)}</strong>
          </div>
          <div className="order-summary-row is-total">
            <span>예상 결제 금액</span>
            <strong>{formatCurrency(estimatedFinalPrice)}</strong>
          </div>
        </div>
      </section>

      <form className="order-form-shell" onSubmit={onSubmit}>
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
            <Link className="button button-secondary" to="/cart">
              장바구니로
            </Link>
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? '주문 생성 중...' : '결제하기'}
            </button>
          </div>
        </section>
      </form>
    </main>
  );
}
