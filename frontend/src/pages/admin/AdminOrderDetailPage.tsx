import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useOutletContext, useParams } from 'react-router-dom';

import { AdminFloatingSubmitButton } from '../../components/admin/AdminFloatingSubmitButton';
import { AdminRefreshButton } from '../../components/admin/AdminRefreshButton';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { AdminOrderDetail, StoreOrderStatus, StoreShipmentStatus, apiClient } from '../../lib/api';
import {
  AdminLayoutContext,
  formatAdminDateTime,
  formatAdminPhone,
  formatCurrency,
  getAllowedNextOrderStatuses,
  getDepositStatusLabel,
  getOrderStatusLabel,
  getShipmentStatusLabel,
} from './adminUtils';

type StatusFormState = {
  changeReason: string;
  orderStatus: StoreOrderStatus | '';
};

type ShipmentFormState = {
  courierName: string;
  trackingNumber: string;
  shipmentStatus: StoreShipmentStatus;
};

const FLOATING_SUBMIT_SUCCESS_MS = 700;

const INITIAL_STATUS_FORM: StatusFormState = {
  changeReason: '',
  orderStatus: '',
};

function createInitialShipmentForm(): ShipmentFormState {
  return {
    courierName: '',
    trackingNumber: '',
    shipmentStatus: 'READY',
  };
}

function formatAddress(order: AdminOrderDetail): string {
  const addressParts = [order.contact.zipcode, order.contact.address1, order.contact.address2].filter(Boolean);
  return addressParts.length > 0 ? addressParts.join(' ') : '-';
}

export function AdminOrderDetailPage() {
  const { orderId } = useParams();
  const parsedOrderId = Number(orderId);
  const isValidOrderId = Number.isInteger(parsedOrderId) && parsedOrderId > 0;

  const { showToast } = useOutletContext<AdminLayoutContext>();

  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusForm, setStatusForm] = useState<StatusFormState>(INITIAL_STATUS_FORM);
  const [shipmentForm, setShipmentForm] = useState<ShipmentFormState>(createInitialShipmentForm());
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [shipmentSubmitting, setShipmentSubmitting] = useState(false);
  const [statusSubmitSuccess, setStatusSubmitSuccess] = useState(false);
  const [shipmentSubmitSuccess, setShipmentSubmitSuccess] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadOrder = async () => {
    if (!isValidOrderId) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await apiClient.getAdminOrderById(parsedOrderId);
      setOrder(result);
      setActionError('');
    } catch (caught) {
      setOrder(null);
      setError(caught instanceof Error ? caught.message : '주문 상세를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrder();
  }, [parsedOrderId]);

  useEffect(() => {
    if (!order) {
      return;
    }

    const allowedNextStatuses = getAllowedNextOrderStatuses(order.orderStatus);

    setStatusForm({
      changeReason: '',
      orderStatus: allowedNextStatuses[0] ?? '',
    });
    setShipmentForm({
      courierName: order.shipment.courierName ?? '',
      trackingNumber: order.shipment.trackingNumber ?? '',
      shipmentStatus: order.shipment.shipmentStatus,
    });
  }, [order]);

  if (!isValidOrderId) {
    return <Navigate to="/admin/orders" replace />;
  }

  const allowedNextStatuses = order ? getAllowedNextOrderStatuses(order.orderStatus) : [];
  const canSubmitStatusChange =
    !!order &&
    statusForm.orderStatus !== '' &&
    statusForm.orderStatus !== order.orderStatus &&
    !statusSubmitting;

  const onSubmitStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!order || statusForm.orderStatus === '') {
      return;
    }

    setStatusSubmitting(true);
    setStatusSubmitSuccess(false);
    setActionError('');

    try {
      await apiClient.updateAdminOrderStatus(order.id, {
        orderStatus: statusForm.orderStatus,
        changeReason: statusForm.changeReason.trim() || undefined,
      });

      setStatusSubmitSuccess(true);
      await new Promise((resolve) => window.setTimeout(resolve, FLOATING_SUBMIT_SUCCESS_MS));
      await loadOrder();
      showToast('주문 상태를 변경했습니다.');
    } catch (caught) {
      setStatusSubmitSuccess(false);
      setActionError(caught instanceof Error ? caught.message : '주문 상태 변경에 실패했습니다.');
    } finally {
      setStatusSubmitting(false);
      setStatusSubmitSuccess(false);
    }
  };

  const onSubmitShipment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!order) {
      return;
    }

    setShipmentSubmitting(true);
    setShipmentSubmitSuccess(false);
    setActionError('');

    try {
      await apiClient.updateAdminOrderShipment(order.id, {
        courierName: shipmentForm.courierName.trim() || null,
        trackingNumber: shipmentForm.trackingNumber.trim() || null,
        shipmentStatus: shipmentForm.shipmentStatus,
      });

      setShipmentSubmitSuccess(true);
      await new Promise((resolve) => window.setTimeout(resolve, FLOATING_SUBMIT_SUCCESS_MS));
      await loadOrder();
      showToast('배송 정보를 저장했습니다.');
    } catch (caught) {
      setShipmentSubmitSuccess(false);
      setActionError(caught instanceof Error ? caught.message : '배송 정보 저장에 실패했습니다.');
    } finally {
      setShipmentSubmitting(false);
      setShipmentSubmitSuccess(false);
    }
  };

  if (loading) {
    return (
      <section className="admin-section">
        <LoadingScreen title="주문 상세를 불러오는 중입니다" message="주문 기본 정보와 상태 이력을 정리하고 있습니다." />
      </section>
    );
  }

  if (!order || error) {
    return (
      <section className="admin-section">
        <section className="surface-card admin-card-stack">
          <p className="section-kicker">Error</p>
          <h2 className="section-subtitle">주문 정보를 확인할 수 없습니다</h2>
          <p className="feedback-copy is-error" role="alert">
            {error || '주문 상세 응답이 비어 있습니다.'}
          </p>
          <div className="inline-actions">
            <button className="button" type="button" onClick={() => void loadOrder()}>
              다시 불러오기
            </button>
            <Link className="button button-secondary" to="/admin/orders">
              목록으로
            </Link>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Order Detail</p>
          <h2 className="section-title admin-section-title">{order.orderNumber}</h2>
          <p className="section-copy">
            상태 변경, 입금 확인 맥락, 배송 정보를 하나의 운영 화면에서 관리할 수 있도록 정리했습니다.
          </p>
        </div>

        <div className="admin-stat-grid">
          <div className="admin-stat-card">
            <span>주문 상태</span>
            <strong>{getOrderStatusLabel(order.orderStatus)}</strong>
          </div>
          <div className="admin-stat-card">
            <span>결제 합계</span>
            <strong>{formatCurrency(order.pricing.finalTotalPrice)}</strong>
          </div>
          <div className="admin-stat-card">
            <span>상품 수</span>
            <strong>{order.items.length}</strong>
          </div>
        </div>
      </section>

      <div className="admin-section-head">
        <div>
          <p className="section-kicker">Operate</p>
          <h3 className="section-subtitle">주문 운영 상세</h3>
        </div>
        <div className="inline-actions">
          <AdminRefreshButton onClick={() => void loadOrder()} disabled={loading} />
          <Link className="button button-secondary" to="/admin/orders">
            목록으로
          </Link>
        </div>
      </div>

      {actionError ? (
        <p className="feedback-copy is-error" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="admin-two-column admin-order-detail-grid">
        <div className="admin-card-stack">
          <section className="surface-card admin-card-stack">
            <div className="admin-section-head">
              <div>
                <p className="section-kicker">Summary</p>
                <h3 className="section-subtitle">주문 기본 정보</h3>
              </div>
              <span className="admin-inline-note">ID {order.id}</span>
            </div>

            <div className="admin-summary-grid">
              <div className="admin-summary-item">
                <span>주문 상태</span>
                <strong>{getOrderStatusLabel(order.orderStatus)}</strong>
              </div>
              <div className="admin-summary-item">
                <span>입금 상태</span>
                <strong>{getDepositStatusLabel(order.deposit.depositStatus)}</strong>
              </div>
              <div className="admin-summary-item">
                <span>배송 상태</span>
                <strong>{getShipmentStatusLabel(order.shipment.shipmentStatus)}</strong>
              </div>
              <div className="admin-summary-item">
                <span>주문 생성</span>
                <strong>{formatAdminDateTime(order.createdAt)}</strong>
              </div>
              <div className="admin-summary-item">
                <span>최근 수정</span>
                <strong>{formatAdminDateTime(order.updatedAt)}</strong>
              </div>
              <div className="admin-summary-item">
                <span>고객 요청</span>
                <strong>{order.customerRequest?.trim() || '없음'}</strong>
              </div>
            </div>
          </section>

          <section className="surface-card admin-card-stack">
            <div className="admin-section-head">
              <div>
                <p className="section-kicker">Items</p>
                <h3 className="section-subtitle">주문 상품</h3>
              </div>
              <span className="admin-inline-note">{order.items.length}개 항목</span>
            </div>

            <div className="admin-list-grid">
              {order.items.length === 0 ? (
                <section className="admin-empty-state">
                  <p className="section-kicker">No Items</p>
                  <h4 className="section-subtitle">주문 상품 정보가 비어 있습니다</h4>
                  <p className="section-copy">응답에서 상품 목록이 누락되어도 화면은 유지되며, 다시 불러오기로 재시도할 수 있습니다.</p>
                </section>
              ) : (
                order.items.map((item, index) => (
                  <article className="admin-list-card" key={`${item.productNameSnapshot}-${index}`}>
                    <div className="admin-list-card-head">
                      <div>
                        <strong>{item.productNameSnapshot}</strong>
                        <p>
                          {[item.optionNameSnapshot, item.optionValueSnapshot].filter(Boolean).join(' / ') || '옵션 없음'}
                        </p>
                      </div>
                      <span className="status-pill is-muted">수량 {item.quantity}</span>
                    </div>

                    <div className="admin-product-summary">
                      <span>단가 {formatCurrency(item.unitPrice)}</span>
                      <span>합계 {formatCurrency(item.lineTotalPrice)}</span>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="surface-card admin-card-stack">
            <div className="admin-section-head">
              <div>
                <p className="section-kicker">Contacts</p>
                <h3 className="section-subtitle">연락처 / 배송지</h3>
              </div>
            </div>

            <div className="admin-summary-grid">
              <div className="admin-summary-item">
                <span>구매자</span>
                <strong>{order.contact.buyerName}</strong>
              </div>
              <div className="admin-summary-item">
                <span>구매자 연락처</span>
                <strong>{formatAdminPhone(order.contact.buyerPhone)}</strong>
              </div>
              <div className="admin-summary-item">
                <span>수령인</span>
                <strong>{order.contact.receiverName}</strong>
              </div>
              <div className="admin-summary-item">
                <span>수령인 연락처</span>
                <strong>{formatAdminPhone(order.contact.receiverPhone)}</strong>
              </div>
              <div className="admin-summary-item admin-summary-item-span-2">
                <span>배송지</span>
                <strong>{formatAddress(order)}</strong>
              </div>
            </div>
          </section>

          <section className="surface-card admin-card-stack">
            <div className="admin-section-head">
              <div>
                <p className="section-kicker">Deposit</p>
                <h3 className="section-subtitle">입금 정보</h3>
              </div>
            </div>

            <div className="admin-summary-grid">
              <div className="admin-summary-item">
                <span>입금 상태</span>
                <strong>{getDepositStatusLabel(order.deposit.depositStatus)}</strong>
              </div>
              <div className="admin-summary-item">
                <span>예상 입금액</span>
                <strong>{formatCurrency(order.deposit.expectedAmount ?? order.pricing.finalTotalPrice)}</strong>
              </div>
              <div className="admin-summary-item">
                <span>입금자명</span>
                <strong>{order.deposit.depositorName || '-'}</strong>
              </div>
              <div className="admin-summary-item">
                <span>입금 기한</span>
                <strong>{formatAdminDateTime(order.deposit.depositDeadlineAt)}</strong>
              </div>
              <div className="admin-summary-item">
                <span>은행</span>
                <strong>{order.deposit.bankName || '-'}</strong>
              </div>
              <div className="admin-summary-item">
                <span>예금주 / 계좌</span>
                <strong>
                  {[order.deposit.accountHolder, order.deposit.accountNumber].filter(Boolean).join(' / ') || '-'}
                </strong>
              </div>
              <div className="admin-summary-item">
                <span>요청 접수</span>
                <strong>{formatAdminDateTime(order.deposit.requestedAt)}</strong>
              </div>
              <div className="admin-summary-item">
                <span>확인 완료</span>
                <strong>{formatAdminDateTime(order.deposit.confirmedAt)}</strong>
              </div>
              <div className="admin-summary-item admin-summary-item-span-2">
                <span>운영 메모</span>
                <strong>{order.deposit.adminMemo?.trim() || '없음'}</strong>
              </div>
            </div>
          </section>

          <section className="surface-card admin-card-stack">
            <div className="admin-section-head">
              <div>
                <p className="section-kicker">History</p>
                <h3 className="section-subtitle">상태 이력</h3>
              </div>
              <span className="admin-inline-note">{order.statusHistories.length}건</span>
            </div>

            {order.statusHistories.length === 0 ? (
              <section className="admin-empty-state">
                <p className="section-kicker">No History</p>
                <h4 className="section-subtitle">등록된 상태 변경 이력이 없습니다</h4>
                <p className="section-copy">이후 상태 변경 액션이 발생하면 이 영역에 누적됩니다.</p>
              </section>
            ) : (
              <div className="admin-status-history-list">
                {order.statusHistories.map((history) => (
                  <article className="admin-list-card" key={history.orderStatusHistoryId}>
                    <div className="admin-list-card-head">
                      <div>
                        <strong>{getOrderStatusLabel(history.newStatus)}</strong>
                        <p>
                          {history.previousStatus ? `${getOrderStatusLabel(history.previousStatus)} -> ` : ''}
                          {getOrderStatusLabel(history.newStatus)}
                        </p>
                      </div>
                      <span className="status-pill is-muted">{formatAdminDateTime(history.createdAt)}</span>
                    </div>

                    <div className="admin-meta-row">
                      <span>변경 관리자 {history.changedByAdminId ? `#${history.changedByAdminId}` : '시스템'}</span>
                    </div>

                    <p className="section-copy admin-history-reason">{history.changeReason?.trim() || '변경 사유 기록 없음'}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="admin-card-stack">
          <section className="surface-card admin-card-stack">
            <div className="admin-section-head">
              <div>
                <p className="section-kicker">Status</p>
                <h3 className="section-subtitle">주문 상태 변경</h3>
              </div>
            </div>

            <form className="admin-card-stack" onSubmit={onSubmitStatus}>
              <AdminFloatingSubmitButton
                busy={statusSubmitting}
                busyLabel="변경 중..."
                disabled={!canSubmitStatusChange}
                label="주문 상태 변경"
                success={statusSubmitSuccess}
                stackIndex={0}
              />
              <div className="admin-overview-chip">
                <span>현재 상태</span>
                <strong>{getOrderStatusLabel(order.orderStatus)}</strong>
                <small>
                  {allowedNextStatuses.length > 0
                    ? `다음 가능 상태 ${allowedNextStatuses.length}개`
                    : '현재 상태에서는 추가 전이가 허용되지 않습니다.'}
                </small>
              </div>

              <label className="field">
                <span>변경할 주문 상태</span>
                <select
                  value={statusForm.orderStatus}
                  onChange={(event) =>
                    setStatusForm((current) => ({
                      ...current,
                      orderStatus: event.target.value as StoreOrderStatus | '',
                    }))
                  }
                  disabled={allowedNextStatuses.length === 0 || statusSubmitting}
                >
                  <option value="">선택하세요</option>
                  {allowedNextStatuses.map((status) => (
                    <option key={status} value={status}>
                      {getOrderStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>변경 사유</span>
                <textarea
                  value={statusForm.changeReason}
                  onChange={(event) =>
                    setStatusForm((current) => ({
                      ...current,
                      changeReason: event.target.value,
                    }))
                  }
                  placeholder="입금 확인, 출고 완료, 고객 요청 등 운영 메모"
                  rows={4}
                />
              </label>

              <button className="button" type="submit" disabled={!canSubmitStatusChange}>
                {statusSubmitting ? '변경 중...' : '주문 상태 변경'}
              </button>
            </form>
          </section>

          <section className="surface-card admin-card-stack">
            <div className="admin-section-head">
              <div>
                <p className="section-kicker">Shipment</p>
                <h3 className="section-subtitle">배송 정보 입력 / 수정</h3>
              </div>
            </div>

            <form className="admin-card-stack" onSubmit={onSubmitShipment}>
              <AdminFloatingSubmitButton
                busy={shipmentSubmitting}
                busyLabel="저장 중..."
                disabled={shipmentSubmitting}
                label="배송 정보 저장"
                success={shipmentSubmitSuccess}
                stackIndex={1}
              />
              <div className="admin-summary-grid">
                <div className="admin-summary-item">
                  <span>현재 배송 상태</span>
                  <strong>{getShipmentStatusLabel(order.shipment.shipmentStatus)}</strong>
                </div>
                <div className="admin-summary-item">
                  <span>운송장 링크</span>
                  <strong>
                    {order.shipment.trackingUrl ? (
                      <a href={order.shipment.trackingUrl} target="_blank" rel="noreferrer">
                        조회 열기
                      </a>
                    ) : (
                      '없음'
                    )}
                  </strong>
                </div>
              </div>

              <label className="field">
                <span>택배사</span>
                <input
                  value={shipmentForm.courierName}
                  onChange={(event) =>
                    setShipmentForm((current) => ({
                      ...current,
                      courierName: event.target.value,
                    }))
                  }
                  placeholder="예: CJ대한통운"
                  autoComplete="off"
                />
              </label>

              <label className="field">
                <span>송장번호</span>
                <input
                  value={shipmentForm.trackingNumber}
                  onChange={(event) =>
                    setShipmentForm((current) => ({
                      ...current,
                      trackingNumber: event.target.value,
                    }))
                  }
                  placeholder="숫자 또는 문자 조합"
                  autoComplete="off"
                />
              </label>

              <label className="field">
                <span>배송 상태</span>
                <select
                  value={shipmentForm.shipmentStatus}
                  onChange={(event) =>
                    setShipmentForm((current) => ({
                      ...current,
                      shipmentStatus: event.target.value as StoreShipmentStatus,
                    }))
                  }
                >
                  <option value="READY">배송 준비 중</option>
                  <option value="SHIPPED">배송 중</option>
                  <option value="DELIVERED">배송 완료</option>
                </select>
              </label>

              <div className="admin-summary-grid">
                <div className="admin-summary-item">
                  <span>발송 시각</span>
                  <strong>{formatAdminDateTime(order.shipment.shippedAt)}</strong>
                </div>
                <div className="admin-summary-item">
                  <span>배송 완료 시각</span>
                  <strong>{formatAdminDateTime(order.shipment.deliveredAt)}</strong>
                </div>
              </div>

              <button className="button" type="submit" disabled={shipmentSubmitting}>
                {shipmentSubmitting ? '저장 중...' : '배송 정보 저장'}
              </button>
            </form>
          </section>
        </div>
      </div>
    </section>
  );
}
