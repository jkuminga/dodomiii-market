import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';

import {
  apiClient,
  ProductDetail,
  StoreDepositStatus,
  StoreOrderCreateResponse,
  StoreOrderStatus,
} from '../../lib/api';

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '미정';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

function getOrderStatusLabel(status: StoreOrderStatus): string {
  switch (status) {
    case 'PENDING_PAYMENT':
      return '입금 대기';
    case 'PAYMENT_REQUESTED':
      return '입금 요청 확인 중';
    case 'PAYMENT_CONFIRMED':
      return '입금 확인 완료';
    case 'PREPARING':
      return '제작 및 출고 준비';
    case 'SHIPPED':
      return '배송 중';
    case 'DELIVERED':
      return '배송 완료';
    case 'CANCELLED':
      return '주문 취소';
    case 'EXPIRED':
      return '입금 기한 만료';
    default:
      return status;
  }
}

function getDepositStatusLabel(status: StoreDepositStatus): string {
  switch (status) {
    case 'WAITING':
      return '입금 대기';
    case 'REQUESTED':
      return '입금 확인 요청';
    case 'CONFIRMED':
      return '입금 확인 완료';
    case 'REJECTED':
      return '입금 재확인 필요';
    default:
      return status;
  }
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
  const prefilledOptionId = searchParams.get('optionId') ?? '';

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contact, setContact] = useState<ContactFormState>(INITIAL_CONTACT_FORM);
  const [selectedOptionId, setSelectedOptionId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedOrder, setSubmittedOrder] = useState<StoreOrderCreateResponse | null>(null);
  const resultCardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!productId) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      setSubmittedOrder(null);
      setSubmitError('');
      setQuantity(1);
      setContact(INITIAL_CONTACT_FORM);

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

  const activeOptions = useMemo(
    () =>
      product
        ? [...product.options]
            .filter((option) => option.isActive)
            .sort((left, right) => left.sortOrder - right.sortOrder)
        : [],
    [product],
  );

  useEffect(() => {
    if (!product) {
      return;
    }

    const hasPrefilledOption = activeOptions.some((option) => String(option.id) === prefilledOptionId);
    const nextOptionId = hasPrefilledOption ? prefilledOptionId : activeOptions.length === 1 ? String(activeOptions[0].id) : '';

    setSelectedOptionId(nextOptionId);
  }, [activeOptions, prefilledOptionId, product]);

  useEffect(() => {
    if (!submittedOrder || !resultCardRef.current) {
      return;
    }

    resultCardRef.current.focus();
  }, [submittedOrder]);

  if (!productId) {
    return <Navigate to="/products" replace />;
  }

  const selectedOption = activeOptions.find((option) => String(option.id) === selectedOptionId) ?? null;
  const estimatedUnitPrice = product ? product.basePrice + (selectedOption?.extraPrice ?? 0) : 0;
  const estimatedSubtotal = estimatedUnitPrice * quantity;
  const requiresOptionSelection = activeOptions.length > 0 && !selectedOptionId;
  const isSubmitDisabled = submitting || !!product?.isSoldOut || requiresOptionSelection;

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

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!product) {
      return;
    }

    if (requiresOptionSelection) {
      setSubmitError('옵션을 먼저 선택해 주세요.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const result = await apiClient.createOrder({
        items: [
          {
            productId: product.id,
            productOptionId: selectedOption ? selectedOption.id : undefined,
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
        },
        customerRequest: contact.customerRequest.trim() || undefined,
      });

      setSubmittedOrder(result);
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : '주문 접수 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="m-page order-page">
        <section className="surface-card status-card" role="status" aria-live="polite">
          <p className="section-kicker">Loading</p>
          <h1 className="section-subtitle">주문서를 준비하는 중</h1>
          <p className="feedback-copy">선택한 상품과 주문 입력 화면을 불러오고 있습니다.</p>
        </section>
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
        <h1 className="section-title">주문서 작성</h1>
        <p className="section-copy">
          선택한 상품 한 건을 바로 접수하는 흐름입니다. 주문자, 수령인, 배송지 정보를 입력하면 주문번호와 입금 안내를
          즉시 확인할 수 있습니다.
        </p>
      </section>

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
          {selectedOption ? (
            <div className="order-summary-row">
              <span>
                선택 옵션
                <small>
                  {selectedOption.optionGroupName} / {selectedOption.optionValue}
                </small>
              </span>
              <strong>{selectedOption.extraPrice > 0 ? `+${formatCurrency(selectedOption.extraPrice)}` : '추가 금액 없음'}</strong>
            </div>
          ) : null}
          <div className="order-summary-row">
            <span>예상 상품 금액</span>
            <strong>{formatCurrency(estimatedSubtotal)}</strong>
          </div>
        </div>

        <p className="feedback-copy">
          배송비와 입금 계좌 정보는 주문 접수 후 확정된 결과 카드에서 확인할 수 있습니다.
        </p>
      </section>

      {submittedOrder ? (
        <section
          ref={resultCardRef}
          className="surface-card order-result-card"
          tabIndex={-1}
          aria-labelledby="order-result-title"
        >
          <div className="section-head">
            <div>
              <p className="section-kicker">Completed</p>
              <h2 className="section-subtitle" id="order-result-title">
                주문이 접수되었습니다
              </h2>
            </div>
            <span className="status-pill">{getOrderStatusLabel(submittedOrder.orderStatus)}</span>
          </div>

          <div className="order-result-grid">
            <div className="order-result-block">
              <h3>주문 정보</h3>
              <div className="order-summary-row">
                <span>주문번호</span>
                <strong>{submittedOrder.orderNumber}</strong>
              </div>
              <div className="order-summary-row">
                <span>현재 상태</span>
                <strong>{getOrderStatusLabel(submittedOrder.orderStatus)}</strong>
              </div>
            </div>

            <div className="order-result-block">
              <h3>결제 금액</h3>
              <div className="order-summary-row">
                <span>상품 금액</span>
                <strong>{formatCurrency(submittedOrder.pricing.totalProductPrice)}</strong>
              </div>
              <div className="order-summary-row">
                <span>배송비</span>
                <strong>{formatCurrency(submittedOrder.pricing.shippingFee)}</strong>
              </div>
              <div className="order-summary-row is-total">
                <span>최종 결제 금액</span>
                <strong>{formatCurrency(submittedOrder.pricing.finalTotalPrice)}</strong>
              </div>
            </div>

            <div className="order-result-block">
              <h3>입금 안내</h3>
              <div className="order-summary-row">
                <span>은행</span>
                <strong>{submittedOrder.depositInfo.bankName}</strong>
              </div>
              <div className="order-summary-row">
                <span>예금주</span>
                <strong>{submittedOrder.depositInfo.accountHolder}</strong>
              </div>
              <div className="order-summary-row">
                <span>계좌번호</span>
                <strong>{submittedOrder.depositInfo.accountNumber}</strong>
              </div>
              <div className="order-summary-row">
                <span>입금 예정 금액</span>
                <strong>{formatCurrency(submittedOrder.depositInfo.expectedAmount)}</strong>
              </div>
              <div className="order-summary-row">
                <span>입금 상태</span>
                <strong>{getDepositStatusLabel(submittedOrder.depositInfo.depositStatus)}</strong>
              </div>
              <p className="feedback-copy order-deposit-note">
                {getDepositStatusLabel(submittedOrder.depositInfo.depositStatus)} · 입금 기한{' '}
                {formatDateTime(submittedOrder.depositInfo.depositDeadlineAt)}
              </p>
            </div>
          </div>

          <div className="inline-actions order-inline-actions">
            <Link
              className="button"
              to={`/orders?orderNumber=${encodeURIComponent(submittedOrder.orderNumber)}`}
              state={{ createdOrder: submittedOrder }}
            >
              주문 조회로 확인
            </Link>
            <Link className="button button-secondary" to={`/products/${product.id}`}>
              상품 상세로 돌아가기
            </Link>
            <button className="button button-ghost" type="button" onClick={() => setSubmittedOrder(null)}>
              주문서 다시 보기
            </button>
          </div>
        </section>
      ) : (
        <form className="surface-card order-form-card" onSubmit={onSubmit}>
          <fieldset className="order-form-section">
            <legend>옵션 및 수량</legend>

            {activeOptions.length > 0 ? (
              <label className="field">
                <span>옵션 선택</span>
                <select
                  name="productOptionId"
                  value={selectedOptionId}
                  onChange={(event) => setSelectedOptionId(event.target.value)}
                  required
                >
                  <option value="">옵션을 선택해 주세요</option>
                  {activeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.optionGroupName} / {option.optionValue}
                      {option.extraPrice > 0 ? ` (+${formatCurrency(option.extraPrice)})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="feedback-copy">추가 옵션이 없는 상품입니다. 수량만 조정해서 바로 주문할 수 있습니다.</p>
            )}

            <div className="field">
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
            </div>
          </fieldset>

          <fieldset className="order-form-section">
            <legend>주문자 정보</legend>

            <label className="field">
              <span>buyerName</span>
              <input value={contact.buyerName} onChange={onContactChange('buyerName')} placeholder="주문자 이름" required />
            </label>

            <label className="field">
              <span>buyerPhone</span>
              <input
                value={contact.buyerPhone}
                onChange={onContactChange('buyerPhone')}
                placeholder="010-1234-5678"
                inputMode="tel"
                required
              />
            </label>
          </fieldset>

          <fieldset className="order-form-section">
            <legend>수령인 정보</legend>

            <label className="field">
              <span>receiverName</span>
              <input value={contact.receiverName} onChange={onContactChange('receiverName')} placeholder="수령인 이름" required />
            </label>

            <label className="field">
              <span>receiverPhone</span>
              <input
                value={contact.receiverPhone}
                onChange={onContactChange('receiverPhone')}
                placeholder="010-1234-5678"
                inputMode="tel"
                required
              />
            </label>
          </fieldset>

          <fieldset className="order-form-section">
            <legend>배송지 정보</legend>

            <label className="field">
              <span>zipcode</span>
              <input value={contact.zipcode} onChange={onContactChange('zipcode')} placeholder="우편번호" inputMode="numeric" required />
            </label>

            <label className="field">
              <span>address1</span>
              <input value={contact.address1} onChange={onContactChange('address1')} placeholder="기본 주소" required />
            </label>

            <label className="field">
              <span>address2</span>
              <input value={contact.address2} onChange={onContactChange('address2')} placeholder="상세 주소" />
            </label>
          </fieldset>

          <fieldset className="order-form-section">
            <legend>추가 요청</legend>

            <label className="field">
              <span>customerRequest</span>
              <textarea
                value={contact.customerRequest}
                onChange={onContactChange('customerRequest')}
                placeholder="배송 요청사항이나 제작 관련 메모를 남겨 주세요"
                rows={4}
              />
            </label>
          </fieldset>

          {product.consultationRequired ? (
            <div className="order-note-card">
              <p className="section-kicker">Consultation</p>
              <p className="feedback-copy">이 상품은 상담이 필요한 상품입니다. 주문 접수 후 추가 확인 연락이 이어질 수 있습니다.</p>
            </div>
          ) : null}

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
              {product.isSoldOut ? '품절 상품' : submitting ? '주문 접수 중...' : '주문 접수하기'}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
