import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';

import { LoadingScreen } from '../../components/common/LoadingScreen';
import { StoreCustomCheckoutLink, StoreDepositStatus, StoreOrderCreateResponse, StoreOrderStatus, apiClient } from '../../lib/api';

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

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '미정';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
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

export function CustomCheckoutPage() {
  const { token } = useParams<{ token: string }>();

  const resultCardRef = useRef<HTMLElement | null>(null);

  const [checkoutLink, setCheckoutLink] = useState<StoreCustomCheckoutLink | null>(null);
  const [contact, setContact] = useState<ContactFormState>(INITIAL_CONTACT_FORM);
  const [submittedOrder, setSubmittedOrder] = useState<StoreOrderCreateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setLoadError('');
      setSubmitError('');
      setSubmittedOrder(null);

      try {
        const result = await apiClient.getCustomCheckoutLinkByToken(token);

        if (cancelled) {
          return;
        }

        setCheckoutLink(result);
      } catch (caught) {
        if (!cancelled) {
          setCheckoutLink(null);
          setLoadError(caught instanceof Error ? caught.message : '커스텀 주문 링크를 확인할 수 없습니다.');
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
  }, [reloadKey, token]);

  useEffect(() => {
    if (!submittedOrder) {
      return;
    }

    resultCardRef.current?.focus();
  }, [submittedOrder]);

  if (!token) {
    return <Navigate to="/" replace />;
  }

  const onContactChange =
    (field: keyof ContactFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setContact((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!checkoutLink || checkoutLink.isExpired) {
      setSubmitError('현재 링크는 주문을 받을 수 없는 상태입니다.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const result = await apiClient.createCustomCheckoutOrder(token, {
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
      setSubmitError(caught instanceof Error ? caught.message : '주문 생성에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="m-page custom-checkout-page">
        <LoadingScreen title="커스텀 주문 링크를 확인하는 중" message="토큰 유효성과 주문 입력 화면을 준비하고 있습니다." />
      </main>
    );
  }

  if (loadError && !checkoutLink) {
    return (
      <main className="m-page custom-checkout-page">
        <section className="surface-card status-card" role="alert">
          <p className="section-kicker">Unavailable</p>
          <h1 className="section-subtitle">링크를 확인할 수 없습니다</h1>
          <p className="feedback-copy is-error">{loadError}</p>
          <p className="feedback-copy">만료, 비활성 처리, 존재하지 않는 토큰일 수 있습니다.</p>
          <div className="inline-actions order-inline-actions">
            <button className="button" type="button" onClick={() => setReloadKey((current) => current + 1)}>
              다시 확인
            </button>
            <Link className="button button-secondary" to="/">
              홈으로
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (!checkoutLink) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="m-page custom-checkout-page">
      <section className="surface-hero compact-hero">
        <p className="section-kicker">Custom Checkout</p>
        <h1 className="section-title">커스텀 주문서</h1>
        <p className="section-copy">
          운영자가 발급한 전용 링크입니다. 협의한 금액과 배송 정보를 다시 확인한 뒤 주문자 정보를 입력해 주문을 접수할 수
          있습니다.
        </p>
      </section>

      <section className="surface-card custom-checkout-summary-card">
        <div className="order-product-head">
          <div>
            <p className="section-kicker">Token</p>
            <h2 className="section-subtitle">{checkoutLink.productName}</h2>
          </div>
          <span className={`status-pill ${checkoutLink.isExpired ? 'is-muted' : ''}`}>
            {checkoutLink.isExpired ? '만료됨' : '주문 가능'}
          </span>
        </div>

        <div className="order-product-summary">
          <div className="order-summary-row">
            <span>협의 상품 금액</span>
            <strong>{formatCurrency(checkoutLink.finalTotalPrice)}</strong>
          </div>
          <div className="order-summary-row">
            <span>만료 시각</span>
            <strong>{formatDateTime(checkoutLink.expiresAt)}</strong>
          </div>
        </div>

        <p className="feedback-copy">배송비와 계좌 정보는 주문 생성 후 결과 카드에서 함께 확인할 수 있습니다.</p>
      </section>

      {checkoutLink.isExpired ? (
        <section className="surface-card status-card" role="alert">
          <p className="section-kicker">Expired</p>
          <h2 className="section-subtitle">이 커스텀 주문 링크는 만료되었습니다</h2>
          <p className="feedback-copy">운영자에게 새 링크 발급을 요청해 주세요.</p>
          <div className="inline-actions order-inline-actions">
            <button className="button" type="button" onClick={() => setReloadKey((current) => current + 1)}>
              상태 다시 확인
            </button>
            <Link className="button button-secondary" to="/">
              홈으로
            </Link>
          </div>
        </section>
      ) : submittedOrder ? (
        <section
          ref={resultCardRef}
          className="surface-card order-result-card custom-checkout-result-card"
          tabIndex={-1}
          aria-labelledby="custom-checkout-result-title"
        >
          <div className="section-head">
            <div>
              <p className="section-kicker">Completed</p>
              <h2 className="section-subtitle" id="custom-checkout-result-title">
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
                입금 기한 {formatDateTime(submittedOrder.depositInfo.depositDeadlineAt)} ·{' '}
                {getDepositStatusLabel(submittedOrder.depositInfo.depositStatus)}
              </p>
            </div>
          </div>

          <div className="inline-actions order-inline-actions">
            <Link className="button" to={`/orders?orderNumber=${encodeURIComponent(submittedOrder.orderNumber)}`}>
              주문 조회
            </Link>
            <button className="button button-secondary" type="button" onClick={() => setSubmittedOrder(null)}>
              입력 화면으로
            </button>
            <Link className="button button-ghost" to="/">
              홈으로
            </Link>
          </div>
        </section>
      ) : (
        <form className="surface-card order-form-card" onSubmit={onSubmit}>
          <fieldset className="order-form-section">
            <legend>주문자 정보</legend>

            <label className="field">
              <span>주문자 이름</span>
              <input value={contact.buyerName} onChange={onContactChange('buyerName')} placeholder="홍길동" required />
            </label>

            <label className="field">
              <span>주문자 연락처</span>
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
              <span>수령인 이름</span>
              <input value={contact.receiverName} onChange={onContactChange('receiverName')} placeholder="홍길동" required />
            </label>

            <label className="field">
              <span>수령인 연락처</span>
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
              <span>우편번호</span>
              <input value={contact.zipcode} onChange={onContactChange('zipcode')} placeholder="06236" inputMode="numeric" required />
            </label>

            <label className="field">
              <span>기본 주소</span>
              <input value={contact.address1} onChange={onContactChange('address1')} placeholder="서울특별시 강남구 ..." required />
            </label>

            <label className="field">
              <span>상세 주소</span>
              <input value={contact.address2} onChange={onContactChange('address2')} placeholder="101동 202호" />
            </label>
          </fieldset>

          <fieldset className="order-form-section">
            <legend>요청사항</legend>

            <label className="field">
              <span>제작 / 배송 요청 메모</span>
              <textarea
                value={contact.customerRequest}
                onChange={onContactChange('customerRequest')}
                placeholder="리본 색상, 카드 문구, 수령 희망 시간 등을 남겨 주세요."
              />
            </label>
          </fieldset>

          {submitError ? (
            <p className="feedback-copy is-error" role="alert">
              {submitError}
            </p>
          ) : null}

          <div className="inline-actions order-inline-actions">
            <button className="button" type="submit" disabled={submitting}>
              {submitting ? '주문 접수 중...' : '주문 접수'}
            </button>
            <button className="button button-secondary" type="button" onClick={() => setContact(INITIAL_CONTACT_FORM)} disabled={submitting}>
              입력 초기화
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
