import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';

import { AdminRefreshButton } from '../../components/admin/AdminRefreshButton';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { AdminCustomOrderLinkDetail, AdminCustomOrderLinkSummary, apiClient } from '../../lib/api';
import { AdminLayoutContext, formatAdminDateTime, formatCurrency } from './adminUtils';

const RECENT_CUSTOM_LINKS_LIMIT = 10;

type CustomOrderFormState = {
  finalTotalPrice: string;
  shippingFee: string;
  expiresAt: string;
  note: string;
};

type RecentCustomOrderLink = AdminCustomOrderLinkSummary & {
  isUsed?: boolean;
};

type CustomOrderStatus = 'used' | 'expired' | 'active';

const CUSTOM_ORDER_STATUS_FILTER_OPTIONS: Array<{ value: 'all' | CustomOrderStatus; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '사용중' },
  { value: 'used', label: '사용완료' },
  { value: 'expired', label: '만료됨' },
];

function toLocalDateTimeInputValue(date: Date): string {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function getDefaultCustomOrderForm(): CustomOrderFormState {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 3);
  expiresAt.setHours(23, 59, 0, 0);

  return {
    finalTotalPrice: '',
    shippingFee: '3000',
    expiresAt: toLocalDateTimeInputValue(expiresAt),
    note: '',
  };
}

function isLinkExpired(expiresAt: string): boolean {
  if (!expiresAt) {
    return false;
  }

  const expiresAtTime = new Date(expiresAt).getTime();

  if (Number.isNaN(expiresAtTime)) {
    return false;
  }

  return expiresAtTime < Date.now();
}

function getCustomOrderStatus(item: { expiresAt: string; isUsed?: boolean }): CustomOrderStatus {
  if (item.isUsed) {
    return 'used';
  }

  if (isLinkExpired(item.expiresAt)) {
    return 'expired';
  }

  return 'active';
}

function getCustomOrderStatusLabel(status: CustomOrderStatus): string {
  switch (status) {
    case 'used':
      return '사용완료';
    case 'expired':
      return '만료됨';
    default:
      return '사용중';
  }
}

async function copyText(value: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const input = document.createElement('textarea');
  input.value = value;
  input.setAttribute('readonly', 'true');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.append(input);
  input.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(input);
  return copied;
}

export function AdminCustomOrdersPage() {
  const { showToast } = useOutletContext<AdminLayoutContext>();
  const detailCardRef = useRef<HTMLElement | null>(null);

  const [form, setForm] = useState<CustomOrderFormState>(getDefaultCustomOrderForm);
  const [recentLinks, setRecentLinks] = useState<RecentCustomOrderLink[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<number | null>(null);
  const [detailLookupId, setDetailLookupId] = useState('');
  const [latestCreatedLink, setLatestCreatedLink] = useState<RecentCustomOrderLink | null>(null);
  const [detail, setDetail] = useState<AdminCustomOrderLinkDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createError, setCreateError] = useState('');
  const [recentError, setRecentError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'all' | CustomOrderStatus>('all');

  const loadRecentLinks = async () => {
    setRecentLoading(true);
    setRecentError('');

    try {
      const items = await apiClient.getAdminCustomOrderLinks(RECENT_CUSTOM_LINKS_LIMIT);
      setRecentLinks(items);
      setSelectedLinkId((current) => {
        if (current && items.some((item) => item.linkId === current)) {
          return current;
        }
        return items[0]?.linkId ?? null;
      });
    } catch (caught) {
      setRecentError(caught instanceof Error ? caught.message : '최근 링크 목록을 불러오지 못했습니다.');
      setRecentLinks([]);
    } finally {
      setRecentLoading(false);
    }
  };

  useEffect(() => {
    void loadRecentLinks();
  }, []);

  useEffect(() => {
    if (selectedLinkId === null && recentLinks.length > 0) {
      const nextLinkId = recentLinks[0]?.linkId ?? null;

      if (nextLinkId !== null) {
        setSelectedLinkId(nextLinkId);
        setDetailLookupId(String(nextLinkId));
      }
    }
  }, [recentLinks, selectedLinkId]);

  useEffect(() => {
    if (selectedLinkId === null) {
      setDetail(null);
      setDetailError('');
      return;
    }

    let cancelled = false;

    const run = async () => {
      setDetailLoading(true);
      setDetailError('');

      try {
        const result = await apiClient.getAdminCustomOrderLinkById(selectedLinkId);

        if (cancelled) {
          return;
        }

        setDetail(result);
        setDetailLookupId(String(result.linkId));
      } catch (caught) {
        if (!cancelled) {
          setDetail(null);
          setDetailError(caught instanceof Error ? caught.message : '링크 상세를 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [detailReloadKey, selectedLinkId]);

  useEffect(() => {
    if (!detail && !detailLoading) {
      return;
    }

    detailCardRef.current?.focus();
  }, [detail, detailLoading]);

  const totalRecentCount = recentLinks.length;
  const activeRecentCount = recentLinks.filter((item) => getCustomOrderStatus(item) === 'active').length;
  const usedRecentCount = recentLinks.filter((item) => getCustomOrderStatus(item) === 'used').length;
  const expiredRecentCount = recentLinks.filter((item) => getCustomOrderStatus(item) === 'expired').length;
  const filteredRecentLinks =
    statusFilter === 'all' ? recentLinks : recentLinks.filter((item) => getCustomOrderStatus(item) === statusFilter);
  const selectedRecentLink = selectedLinkId === null ? null : recentLinks.find((item) => item.linkId === selectedLinkId) ?? null;
  const detailStatus = detail ? getCustomOrderStatus(detail) : null;

  const updateFormField =
    (field: keyof CustomOrderFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value,
      }));
    };

  const refreshSelectedDetail = () => {
    if (selectedLinkId === null) {
      return;
    }

    setDetailReloadKey((current) => current + 1);
  };

  const handleCopy = async (value: string, successMessage: string) => {
    try {
      const copied = await copyText(value);

      if (!copied) {
        throw new Error('복사 기능을 사용할 수 없습니다.');
      }

      showToast(successMessage);
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : '복사에 실패했습니다.', 'error');
    }
  };

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const finalTotalPrice = Number(form.finalTotalPrice);
    const shippingFee = Number(form.shippingFee);
    const expiresAt = new Date(form.expiresAt);

    if (!Number.isFinite(finalTotalPrice) || finalTotalPrice <= 0) {
      setCreateError('상품 협의 금액은 0보다 큰 숫자로 입력해 주세요.');
      return;
    }

    if (!Number.isFinite(shippingFee) || shippingFee < 0) {
      setCreateError('배송비는 0 이상 숫자로 입력해 주세요.');
      return;
    }

    if (Number.isNaN(expiresAt.getTime())) {
      setCreateError('만료 시각 형식이 올바르지 않습니다.');
      return;
    }

    setCreating(true);
    setCreateError('');

    try {
      const result = await apiClient.createAdminCustomOrderLink({
        finalTotalPrice,
        shippingFee,
        note: form.note.trim() || undefined,
        expiresAt: expiresAt.toISOString(),
      });

      const nextRecentLink: RecentCustomOrderLink = {
        ...result,
        isUsed: false,
        note: form.note.trim(),
        usedOrderId: null,
      };

      setLatestCreatedLink(nextRecentLink);
      await loadRecentLinks();
      setSelectedLinkId(result.linkId);
      setDetailLookupId(String(result.linkId));
      setDetailReloadKey((current) => current + 1);
      setForm((current) => ({
        ...getDefaultCustomOrderForm(),
        shippingFee: current.shippingFee,
      }));
      showToast('커스텀 주문 링크를 생성했습니다.');
    } catch (caught) {
      setCreateError(caught instanceof Error ? caught.message : '링크 생성에 실패했습니다.');
    } finally {
      setCreating(false);
    }
  };

  const onDetailLookupSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextLinkId = Number(detailLookupId);

    if (!Number.isFinite(nextLinkId) || nextLinkId <= 0) {
      setDetailError('조회할 링크 ID를 숫자로 입력해 주세요.');
      return;
    }

    if (selectedLinkId === nextLinkId) {
      refreshSelectedDetail();
      return;
    }

    setSelectedLinkId(nextLinkId);
  };

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Custom Orders</p>
          <h2 className="section-title admin-section-title">커스텀 주문 링크 운영</h2>
          <p className="section-copy">
            M09 계약 기준으로 금액, 배송비, 만료 시각, 운영 메모를 묶어 링크를 발급하고 사용 상태를 재조회할 수 있게
            구성했습니다.
          </p>
        </div>

          <div className="admin-stat-grid">
          <div className="admin-stat-card">
            <span>최근 링크</span>
            <strong>{totalRecentCount}</strong>
          </div>
          <div className="admin-stat-card">
            <span>운영 중</span>
            <strong>{activeRecentCount}</strong>
          </div>
          <div className="admin-stat-card">
            <span>사용 완료</span>
            <strong>{usedRecentCount}</strong>
          </div>
          <div className="admin-stat-card">
            <span>만료됨</span>
            <strong>{expiredRecentCount}</strong>
          </div>
        </div>
      </section>

      <div className="admin-two-column custom-order-admin-grid">
        <div className="admin-card-stack">
          <form className="surface-card admin-card-stack" onSubmit={onCreate}>
            <div className="admin-section-head">
              <div>
                <p className="section-kicker">Create</p>
                <h3 className="section-subtitle">새 링크 생성</h3>
              </div>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => {
                  setForm(getDefaultCustomOrderForm());
                  setCreateError('');
                }}
                disabled={creating}
              >
                입력 초기화
              </button>
            </div>

            <div className="admin-field-grid">
              <label className="field">
                <span>상품 협의 금액</span>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={form.finalTotalPrice}
                  onChange={updateFormField('finalTotalPrice')}
                  placeholder="55000"
                  required
                />
              </label>

              <label className="field">
                <span>배송비</span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={form.shippingFee}
                  onChange={updateFormField('shippingFee')}
                  placeholder="3000"
                  required
                />
              </label>

              <label className="field admin-field-span-2">
                <span>만료 시각</span>
                <input type="datetime-local" value={form.expiresAt} onChange={updateFormField('expiresAt')} required />
              </label>

              <label className="field admin-field-span-2">
                <span>운영 메모</span>
                <textarea
                  value={form.note}
                  onChange={updateFormField('note')}
                  placeholder="오픈채팅 협의 내용, 요청 옵션, 포장 메모 등을 남겨 두세요."
                />
              </label>
            </div>

            <section className="custom-order-estimate-card" aria-label="예상 결제 안내">
              <div className="custom-order-estimate-row">
                <span>상품 협의 금액</span>
                <strong>{formatCurrency(Number(form.finalTotalPrice) || 0)}</strong>
              </div>
              <div className="custom-order-estimate-row">
                <span>배송비</span>
                <strong>{formatCurrency(Number(form.shippingFee) || 0)}</strong>
              </div>
              <div className="custom-order-estimate-row is-total">
                <span>예상 결제 합계</span>
                <strong>{formatCurrency((Number(form.finalTotalPrice) || 0) + (Number(form.shippingFee) || 0))}</strong>
              </div>
            </section>

            {createError ? (
              <p className="feedback-copy is-error" role="alert">
                {createError}
              </p>
            ) : null}

            <div className="inline-actions">
              <button className="button" type="submit" disabled={creating}>
                {creating ? '생성 중...' : '링크 생성'}
              </button>
            </div>
          </form>

          {latestCreatedLink ? (
            <section className="surface-card admin-card-stack">
              <div className="admin-section-head">
                <div>
                  <p className="section-kicker">Latest</p>
                  <h3 className="section-subtitle">방금 생성한 링크</h3>
                </div>
                <span className="status-pill">{getCustomOrderStatusLabel(getCustomOrderStatus(latestCreatedLink))}</span>
              </div>

              <div className="custom-link-copy-box">
                <label className="field">
                  <span>체크아웃 URL</span>
                  <input value={latestCreatedLink.checkoutUrl} readOnly />
                </label>
                <div className="inline-actions">
                  <button
                    className="button"
                    type="button"
                    onClick={() => void handleCopy(latestCreatedLink.checkoutUrl, '체크아웃 링크를 복사했습니다.')}
                  >
                    링크 복사
                  </button>
                  <Link className="button button-secondary" to={`/custom-checkout/${latestCreatedLink.token}`}>
                    사용자 화면 보기
                  </Link>
                </div>
              </div>
            </section>
          ) : null}

          <section className="surface-card admin-card-stack">
            <div className="admin-section-head">
              <div>
                <p className="section-kicker">List</p>
                <h3 className="section-subtitle">생된 링크 목록</h3>
              </div>
              <span className="admin-inline-note">※ 최신 {RECENT_CUSTOM_LINKS_LIMIT}건 출력</span>
            </div>

            {/* <form className="custom-link-lookup-form" onSubmit={onDetailLookupSubmit}>
              <label className="field">
                <span>링크 ID로 상세 조회</span>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={detailLookupId}
                  onChange={(event) => setDetailLookupId(event.target.value)}
                  placeholder="71"
                />
              </label>
              <button className="button button-secondary" type="submit">
                조회
              </button>
            </form> */}

            <div className="admin-status-filter-row" role="tablist" aria-label="커스텀 링크 상태 필터">
              {CUSTOM_ORDER_STATUS_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  className={`admin-status-filter-button ${statusFilter === option.value ? 'is-active' : ''}`}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === option.value}
                  onClick={() => setStatusFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {recentLoading ? <LoadingScreen mode="inline" title="최근 링크 로딩 중" message="최근 생성 링크를 불러오고 있습니다." /> : null}
            {recentError ? (
              <p className="feedback-copy is-error" role="alert">
                {recentError}
              </p>
            ) : null}

            {!recentLoading && !recentError && filteredRecentLinks.length === 0 ? (
              <section className="admin-empty-state">
                <p className="section-kicker">Empty</p>
                <h4 className="section-subtitle">선택한 상태의 링크가 없습니다</h4>
                <p className="section-copy">상태 필터를 바꾸거나 새 링크를 생성해 확인할 수 있습니다.</p>
              </section>
            ) : null}

            {!recentLoading && !recentError && filteredRecentLinks.length > 0 ? (
              <div className="custom-link-list">
                {filteredRecentLinks.map((link) => {
                   const status = getCustomOrderStatus(link);

                  return (
                    <article
                      className={`admin-list-card custom-link-list-card ${selectedLinkId === link.linkId ? 'is-selected' : ''}`}
                      key={link.linkId}
                    >
                      <div className="admin-list-card-head">
                        <div>
                          <strong>링크 #{link.linkId}</strong>
                          <p>생성 {formatAdminDateTime(link.createdAt)}</p>
                        </div>
                        <span className={`status-pill ${status === 'expired' ? 'is-muted' : ''}`}>
                          {getCustomOrderStatusLabel(status)}
                        </span>
                      </div>

                      <div className="custom-link-list-grid">
                        <span>상품 협의 금액 {formatCurrency(link.finalTotalPrice)}</span>
                        <span>배송비 {formatCurrency(link.shippingFee)}</span>
                        <span>만료 {formatAdminDateTime(link.expiresAt)}</span>
                        <span>{link.note?.trim() ? link.note : '메모 없음'}</span>
                      </div>

                      <div className="inline-actions custom-link-card-actions">
                        <button
                          className="button button-ghost"
                          type="button"
                          onClick={() => {
                            setSelectedLinkId(link.linkId);
                            if (selectedLinkId === link.linkId) {
                              refreshSelectedDetail();
                            }
                          }}
                        >
                          상세 보기
                        </button>
                        <button
                          className="button button-secondary"
                          type="button"
                          onClick={() => void handleCopy(link.checkoutUrl, '체크아웃 링크를 복사했습니다.')}
                        >
                          링크 복사
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>
        </div>

        <section ref={detailCardRef} className="surface-card admin-card-stack" tabIndex={-1}>
          <div className="admin-section-head">
            <div>
              <p className="section-kicker">Detail</p>
              <h3 className="section-subtitle">링크 상세</h3>
            </div>
            <div className="inline-actions">
              <AdminRefreshButton onClick={refreshSelectedDetail} disabled={selectedLinkId === null || detailLoading} />
              {detail ? (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => void handleCopy(detail.checkoutUrl, '체크아웃 링크를 복사했습니다.')}
                >
                  링크 복사
                </button>
              ) : null}
            </div>
          </div>

          {detailLoading ? <LoadingScreen mode="inline" title="링크 상세 로딩 중" message="선택한 링크 상세를 불러오고 있습니다." /> : null}
          {detailError ? (
            <p className="feedback-copy is-error" role="alert">
              {detailError}
            </p>
          ) : null}
          {!detailLoading && !detailError && !detail ? (
            <section className="admin-empty-state">
              <p className="section-kicker">Ready</p>
              <h4 className="section-subtitle">조회할 링크를 선택해 주세요</h4>
              <p className="section-copy">최근 생성 목록에서 선택하거나 링크 ID를 입력하면 상세 상태를 확인할 수 있습니다.</p>
            </section>
          ) : null}

          {!detailLoading && detail ? (
            <>
              <div className="custom-link-detail-grid">
                <div className="admin-summary-item">
                  <span>상태</span>
                  <strong>{detailStatus ? getCustomOrderStatusLabel(detailStatus) : '-'}</strong>
                </div>
                <div className="admin-summary-item">
                  <span>링크 ID</span>
                  <strong>{detail.linkId}</strong>
                </div>
                <div className="admin-summary-item">
                  <span>상품 협의 금액</span>
                  <strong>{formatCurrency(detail.finalTotalPrice)}</strong>
                </div>
                <div className="admin-summary-item">
                  <span>배송비 포함 합계</span>
                  <strong>{formatCurrency(detail.finalTotalPrice + detail.shippingFee)}</strong>
                </div>
              </div>

              <div className="custom-link-detail-block">
                <div className="custom-order-estimate-row">
                  <span>토큰</span>
                  <strong>{detail.token}</strong>
                </div>
                <div className="custom-order-estimate-row">
                  <span>생성 시각</span>
                  <strong>{formatAdminDateTime(detail.createdAt)}</strong>
                </div>
                <div className="custom-order-estimate-row">
                  <span>만료 시각</span>
                  <strong>{formatAdminDateTime(detail.expiresAt)}</strong>
                </div>
                <div className="custom-order-estimate-row">
                  <span>사용 주문 ID</span>
                  <strong>{detail.usedOrderId ?? '미사용'}</strong>
                </div>
              </div>

              <label className="field">
                <span>체크아웃 URL</span>
                <input value={detail.checkoutUrl} readOnly />
              </label>

              {selectedRecentLink?.note?.trim() ? (
                <section className="custom-detail-note">
                  <p className="section-kicker">Memo</p>
                  <p className="section-copy">{selectedRecentLink.note}</p>
                </section>
              ) : null}

              <div className="inline-actions custom-link-card-actions">
                <Link className="button" to={`/custom-checkout/${detail.token}`}>
                  사용자 화면 보기
                </Link>
                {detail.usedOrderId ? (
                  <Link className="button button-secondary" to={`/admin/orders/${detail.usedOrderId}`}>
                    연결된 주문 보기
                  </Link>
                ) : null}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}
