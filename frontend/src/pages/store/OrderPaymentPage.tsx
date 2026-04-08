import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import { LoadingScreen } from '../../components/common/LoadingScreen';
import { apiClient, StoreDepositRequestPayload, StoreOrderCreateResponse, StoreOrderLookupResponse } from '../../lib/api';

type OrderPaymentLocationState = {
  createdOrder?: StoreOrderCreateResponse;
};

type DepositRequestFormState = {
  depositorName: string;
  memo: string;
};

type CopyToastState = {
  message: string;
  tone: 'success' | 'error';
};

const INITIAL_DEPOSIT_REQUEST_FORM: DepositRequestFormState = {
  depositorName: '',
  memo: '',
};

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '미정';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

async function copyToClipboard(value: string): Promise<boolean> {
  if (!value.trim()) {
    return false;
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

function buildOrderFromCreated(createdOrder: StoreOrderCreateResponse): StoreOrderLookupResponse {
  return {
    orderNumber: createdOrder.orderNumber,
    orderStatus: createdOrder.orderStatus,
    items:
      createdOrder.items?.map((item) => ({
        productNameSnapshot: item.productNameSnapshot,
        optionNameSnapshot: item.optionNameSnapshot,
        optionValueSnapshot: item.optionValueSnapshot,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotalPrice: item.lineTotalPrice,
      })) ?? [],
    contact: {
      buyerName: '',
      buyerPhone: '',
      receiverName: '',
      receiverPhone: '',
      zipcode: '',
      address1: '',
      address2: null,
    },
    pricing: createdOrder.pricing,
    deposit: {
      depositStatus: createdOrder.depositInfo.depositStatus,
      bankName: createdOrder.depositInfo.bankName,
      accountHolder: createdOrder.depositInfo.accountHolder,
      accountNumber: createdOrder.depositInfo.accountNumber,
      expectedAmount: createdOrder.depositInfo.expectedAmount,
      requestedAt: null,
      confirmedAt: null,
      depositorName: null,
      adminMemo: null,
    },
    shipment: {
      shipmentStatus: 'READY',
      courierName: null,
      trackingNumber: null,
      trackingUrl: null,
      shippedAt: null,
      deliveredAt: null,
    },
    statusHistories: [],
    createdAt: createdOrder.createdAt,
    updatedAt: createdOrder.createdAt ?? new Date().toISOString(),
  };
}

export function OrderPaymentPage() {
  const { orderNumber: orderNumberParam } = useParams<{ orderNumber: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const locationState = location.state as OrderPaymentLocationState | null;
  const createdOrder = locationState?.createdOrder ?? null;
  const orderNumber = orderNumberParam ? decodeURIComponent(orderNumberParam).trim().toUpperCase() : '';

  const [order, setOrder] = useState<StoreOrderLookupResponse | null>(
    createdOrder && createdOrder.orderNumber === orderNumber ? buildOrderFromCreated(createdOrder) : null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [depositRequestForm, setDepositRequestForm] = useState<DepositRequestFormState>(INITIAL_DEPOSIT_REQUEST_FORM);
  const [depositRequestLoading, setDepositRequestLoading] = useState(false);
  const [depositRequestError, setDepositRequestError] = useState('');
  const [copyToast, setCopyToast] = useState<CopyToastState | null>(null);

  useEffect(() => {
    if (!orderNumber) {
      setLoading(false);
      setError('유효한 주문번호가 필요합니다.');
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const result = await apiClient.getOrderByNumber(orderNumber);
        if (cancelled) {
          return;
        }
        setOrder(result);
      } catch (caught) {
        if (!cancelled) {
          setOrder(null);
          setError(caught instanceof Error ? caught.message : '주문 정보를 불러오지 못했습니다.');
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
  }, [orderNumber]);

  useEffect(() => {
    if (!order) {
      setDepositRequestForm(INITIAL_DEPOSIT_REQUEST_FORM);
      return;
    }

    setDepositRequestForm({
      depositorName: order.deposit.depositorName ?? order.contact.buyerName ?? '',
      memo: '',
    });
  }, [order?.orderNumber]);

  useEffect(() => {
    if (!copyToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyToast(null);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyToast]);

  const requestBlockedReason = useMemo(() => {
    if (!order || loading || depositRequestLoading) {
      return null;
    }

    if (!depositRequestForm.depositorName.trim()) {
      return '입금자명을 입력해 주세요.';
    }

    if (order.deposit.depositStatus === 'REQUESTED') {
      return '이미 입금 확인 요청이 접수된 주문입니다.';
    }

    if (order.deposit.depositStatus === 'CONFIRMED') {
      return '이미 입금 확인이 완료된 주문입니다.';
    }

    if (order.orderStatus === 'CANCELLED') {
      return '취소된 주문은 입금 확인 요청을 할 수 없습니다.';
    }

    if (order.orderStatus === 'EXPIRED') {
      return '입금 기한이 만료된 주문입니다.';
    }

    return null;
  }, [depositRequestForm.depositorName, depositRequestLoading, loading, order]);

  const canRequestDeposit = Boolean(order) && !loading && !depositRequestLoading && !requestBlockedReason;

  const onRequestDeposit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!order) {
      return;
    }

    if (requestBlockedReason) {
      setDepositRequestError(requestBlockedReason);
      return;
    }

    setDepositRequestLoading(true);
    setDepositRequestError('');

    const payload: StoreDepositRequestPayload = {
      depositorName: depositRequestForm.depositorName.trim() || undefined,
      memo: depositRequestForm.memo.trim() || undefined,
    };

    try {
      const result = await apiClient.requestDeposit(order.orderNumber, payload);

      setOrder((current) => {
        if (!current || current.orderNumber !== result.orderNumber) {
          return current;
        }

        return {
          ...current,
          orderStatus: result.orderStatus,
          deposit: {
            ...current.deposit,
            depositStatus: result.depositStatus,
            requestedAt: result.requestedAt,
            depositorName: payload.depositorName ?? current.deposit.depositorName ?? null,
          },
          updatedAt: result.requestedAt ?? current.updatedAt,
        };
      });

      navigate(`/orders/${encodeURIComponent(result.orderNumber)}/deposit-request-complete`, {
        state: {
          orderSummary: {
            orderNumber: result.orderNumber,
            totalAmount: order.pricing.finalTotalPrice,
            firstItemName: order.items[0]?.productNameSnapshot ?? '주문 상품',
            itemCount: order.items.length,
          },
        },
      });
    } catch (caught) {
      setDepositRequestError(caught instanceof Error ? caught.message : '입금 확인 요청 처리 중 오류가 발생했습니다.');
    } finally {
      setDepositRequestLoading(false);
    }
  };

  const onCopy = async (value: string, label: string) => {
    const copied = await copyToClipboard(value);
    setCopyToast({
      message: copied ? `✅ ${label} 복사됨` : '복사에 실패했습니다.',
      tone: copied ? 'success' : 'error',
    });
  };

  if (!orderNumber) {
    return <NavigateToProducts />;
  }

  if (loading) {
    return (
      <main className="m-page order-lookup-page">
        <LoadingScreen title="결제 정보를 준비하는 중" message="입금 계좌와 결제 상태를 불러오고 있습니다." />
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="m-page order-lookup-page">
        <section className="surface-card status-card" role="alert">
          <p className="section-kicker">Unavailable</p>
          <h1 className="section-subtitle">결제 정보를 열 수 없습니다</h1>
          <p className="feedback-copy is-error">{error || '주문 정보를 찾지 못했습니다.'}</p>
          <div className="inline-actions order-inline-actions">
            <Link className="button button-secondary" to="/orders">
              주문 조회로 이동
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="m-page order-lookup-page">
      <section className="surface-hero compact-hero payment-hero-align">
        <p className="section-kicker">Payment</p>
        <h1 className="section-title payment-title">계좌 입금 결제</h1>
        <p className="section-copy">아래 계좌 정보로 입금 후, 입금 확인 요청 버튼을 눌러 주세요.</p>
      </section>

      <section className="surface-card order-lookup-summary payment-focus-card">
        <div className="section-head">
          <div>
            <p className="section-kicker">Amount</p>
            <h2 className="section-subtitle payment-amount">{formatCurrency(order.pricing.finalTotalPrice)}</h2>
          </div>
        </div>
        {/* <p className="feedback-copy">입금 기한: {formatDateTime(order.deposit.depositDeadlineAt)}</p> */}
      </section>

      <section className="surface-card order-lookup-summary">
        <div className="section-head">
          <div>
            <p className="section-kicker">Account</p>
            <h2 className="section-subtitle">입금 계좌 정보</h2>
            <p className="feedback-copy">입금 기한: {formatDateTime(order.deposit.depositDeadlineAt)}</p>
          </div>
        </div>
        <div className="order-lookup-grid payment-account-grid">
          <div className="order-lookup-block">
            {/* <h3>계좌</h3> */}
            <div className="order-summary-row">
              <span>은행</span>
              <strong>{order.deposit.bankName ?? '-'}</strong>
            </div>
            <div className="order-summary-row">
              <span>예금주</span>
              <strong>{order.deposit.accountHolder ?? '-'}</strong>
            </div>
            <div className="order-summary-row is-total">
              <span>계좌번호</span>
              <strong>{order.deposit.accountNumber ?? '-'}</strong>
            </div>
            <div className="inline-actions order-inline-actions">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => void onCopy(order.deposit.accountNumber ?? '', '계좌번호')}
                disabled={!order.deposit.accountNumber}
              >
                계좌번호 복사
              </button>
            </div>
          </div>
        </div>
      </section>

      <form className="surface-card order-lookup-form" onSubmit={onRequestDeposit}>
        <div className="section-head">
          <div>
            <p className="section-kicker">Confirm</p>
            <h2 className="section-subtitle">입금 확인 요청</h2>
          </div>
        </div>

        <div className="lookup-input-row">
          <label className="field">
            <span>입금자명</span>
            <input
              value={depositRequestForm.depositorName}
              onChange={(event) =>
                setDepositRequestForm((current) => ({
                  ...current,
                  depositorName: event.target.value,
                }))
              }
              placeholder="입금자명"
              required
            />
          </label>
        </div>

        <label className="field">
          <span>메모 (선택)</span>
          <textarea
            value={depositRequestForm.memo}
            onChange={(event) =>
              setDepositRequestForm((current) => ({
                ...current,
                memo: event.target.value,
              }))
            }
            placeholder="관리자에게 남길 요청사항"
            rows={3}
          />
        </label>

        {depositRequestError ? (
          <p className="feedback-copy is-error" role="alert">
            {depositRequestError}
          </p>
        ) : null}
        {!depositRequestError && requestBlockedReason ? <p className="feedback-copy">{requestBlockedReason}</p> : null}

        <div className="inline-actions order-inline-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={() => navigate(`/orders?orderNumber=${encodeURIComponent(order.orderNumber)}`)}
          >
            주문 조회로 이동
          </button>
          <button className="button" type="submit" disabled={!canRequestDeposit}>
            {depositRequestLoading ? '요청 처리 중...' : '입금 확인 요청하기'}
          </button>
        </div>
      </form>

      {copyToast ? (
        <div className={`payment-copy-toast is-${copyToast.tone}`} role="status" aria-live="polite" aria-atomic="true">
          {copyToast.message}
        </div>
      ) : null}
    </main>
  );
}

function NavigateToProducts() {
  return (
    <main className="m-page order-lookup-page">
      <section className="surface-card status-card">
        <p className="section-kicker">Invalid</p>
        <h1 className="section-subtitle">주문번호가 필요합니다</h1>
        <div className="inline-actions order-inline-actions">
          <Link className="button button-secondary" to="/products">
            상품 목록으로
          </Link>
        </div>
      </section>
    </main>
  );
}
