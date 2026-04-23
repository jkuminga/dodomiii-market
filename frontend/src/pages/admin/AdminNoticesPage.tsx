import { FormEvent, useEffect, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';

import { AdminRefreshButton } from '../../components/admin/AdminRefreshButton';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { AdminNoticeListItem, apiClient, PaginationMeta } from '../../lib/api';
import { AdminLayoutContext, formatAdminDateTime } from './adminUtils';

function parseBooleanFilter(value: string | null): boolean | undefined {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return undefined;
}

export function AdminNoticesPage() {
  const { showToast } = useOutletContext<AdminLayoutContext>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [notices, setNotices] = useState<AdminNoticeListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, size: 10, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const q = searchParams.get('q') ?? '';
  const isPublishedParam = searchParams.get('isPublished') ?? 'all';
  const page = Number(searchParams.get('page') ?? '1');

  const loadNotices = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await apiClient.getAdminNotices({
        q: q || undefined,
        isPublished: parseBooleanFilter(isPublishedParam === 'all' ? null : isPublishedParam),
        page,
        size: 10,
      });

      setNotices(result.data.items);
      setMeta(result.meta);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '공지사항 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotices();
  }, [isPublishedParam, page, q]);

  const onFilterSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const next = new URLSearchParams();
    const nextQuery = String(formData.get('q') ?? '').trim();
    const nextPublished = String(formData.get('isPublished') ?? 'all');

    if (nextQuery) {
      next.set('q', nextQuery);
    }

    if (nextPublished !== 'all') {
      next.set('isPublished', nextPublished);
    }

    next.set('page', '1');
    setSearchParams(next);
  };

  const onMovePage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
  };

  const onDelete = async (notice: AdminNoticeListItem) => {
    const confirmed = window.confirm(`'${notice.title}' 공지사항을 삭제하시겠습니까?`);

    if (!confirmed) {
      return;
    }

    setDeletingId(notice.id);
    setError('');

    try {
      await apiClient.deleteAdminNotice(notice.id);
      showToast('공지사항을 삭제했습니다.');

      if (notices.length === 1 && page > 1) {
        const next = new URLSearchParams(searchParams);
        next.set('page', String(page - 1));
        setSearchParams(next);
      } else {
        await loadNotices();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '공지사항 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Notices</p>
          <h2 className="section-title admin-section-title">공지사항 관리</h2>
        </div>

        <div className="admin-stat-grid">
          <div className="admin-stat-card">
            <span>공지 수</span>
            <strong>{meta.totalItems}</strong>
          </div>
        </div>
      </section>

      <form className="surface-card admin-card-stack admin-filter-panel" onSubmit={onFilterSubmit}>
        <div className="admin-section-head">
          <div>
            <p className="section-kicker">Filters</p>
            <h3 className="section-subtitle">공지 조회 조건</h3>
          </div>
        </div>

        <div className="admin-field-grid">
          <label className="field">
            <span>검색어</span>
            <input name="q" defaultValue={q} placeholder="제목 또는 요약 검색" />
          </label>

          <label className="field">
            <span>공개 상태</span>
            <select name="isPublished" defaultValue={isPublishedParam}>
              <option value="all">전체</option>
              <option value="true">공개</option>
              <option value="false">비공개</option>
            </select>
          </label>
        </div>

        <div className="inline-actions">
          <button className="button" type="submit">
            조건 적용
          </button>
          <AdminRefreshButton onClick={() => void loadNotices()} disabled={loading} />
        </div>
      </form>

      <section className="surface-card admin-card-stack">
        <div className="admin-section-head">
          <div>
            <p className="section-kicker">List</p>
            <h3 className="section-subtitle">공지사항 목록</h3>
          </div>
          <Link className="button" to="/admin/notices/new">
            +
          </Link>
        </div>

        {loading ? <LoadingScreen mode="inline" title="공지 목록 로딩 중" message="공지사항 목록을 불러오고 있습니다." /> : null}
        {error ? (
          <p className="feedback-copy is-error" role="alert">
            {error}
          </p>
        ) : null}
        {!loading && !error && notices.length === 0 ? (
          <section className="admin-empty-state">
            <p className="section-kicker">Empty</p>
            <h4 className="section-subtitle">등록된 공지사항이 없습니다</h4>
            <p className="section-copy">새 공지를 작성해 스토어 공지사항 페이지를 채울 수 있습니다.</p>
          </section>
        ) : null}

        {!loading && !error && notices.length > 0 ? (
          <>
            <div className="admin-list-grid">
              {notices.map((notice) => (
                <article className="admin-list-card admin-notice-dashboard-card" key={notice.id}>
                  <div className="admin-notice-dashboard-main">
                    <strong className="admin-notice-dashboard-title">{notice.title}</strong>
                    <div className="admin-pill-row">
                      {notice.isPinned ? <span className="status-pill">고정</span> : null}
                      <span className={`status-pill ${notice.isPublished ? '' : 'is-muted'}`}>
                        {notice.isPublished ? '공개' : '비공개'}
                      </span>
                    </div>
                  </div>

                  <dl className="admin-notice-dashboard-meta">
                    <div>
                      <dt>게시일</dt>
                      <dd>{notice.publishedAt ? formatAdminDateTime(notice.publishedAt) : '게시 전'}</dd>
                    </div>
                    <div>
                      <dt>수정일</dt>
                      <dd>{formatAdminDateTime(notice.updatedAt)}</dd>
                    </div>
                  </dl>

                  <div className="admin-notice-dashboard-actions">
                    <Link className="button button-secondary" to={`/admin/notices/${notice.id}`}>
                      수정
                    </Link>
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() => void onDelete(notice)}
                      disabled={deletingId === notice.id}
                    >
                      {deletingId === notice.id ? '삭제 중...' : '삭제'}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="pagination-bar">
              <button className="button button-ghost" type="button" onClick={() => onMovePage(meta.page - 1)} disabled={meta.page <= 1}>
                이전
              </button>
              <span className="pagination-status">
                {meta.page} / {meta.totalPages || 1}
              </span>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => onMovePage(meta.page + 1)}
                disabled={meta.totalPages === 0 || meta.page >= meta.totalPages}
              >
                다음
              </button>
            </div>
          </>
        ) : null}
      </section>
    </section>
  );
}
