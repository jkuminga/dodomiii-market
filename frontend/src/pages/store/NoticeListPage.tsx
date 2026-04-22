import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { LoadingScreen } from '../../components/common/LoadingScreen';
import { StoreNoticeListItem, apiClient } from '../../lib/api';

function formatNoticeDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR');
}

function PinIcon() {
  return (
    <svg aria-hidden="true" className="notice-pin-icon" viewBox="0 0 24 24">
      <path d="M15.5 4.5a1 1 0 0 1 .9 1.5l-1.7 2.8 2.3 2.3a1 1 0 0 1-.7 1.7h-3.1l-4.8 5.3a.7.7 0 0 1-1.2-.6l.7-3.3-2.2-2.2a1 1 0 0 1 .7-1.7h3L11 5.8a1 1 0 0 1 .9-.8z" />
    </svg>
  );
}

export function NoticeListPage() {
  const [notices, setNotices] = useState<StoreNoticeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const result = await apiClient.getStoreNotices();

        if (!cancelled) {
          setNotices(result);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '공지사항을 불러오지 못했습니다.');
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
  }, []);

  return (
    <main className="m-page notice-page-wrap">
      <section className="surface-card notice-page-hero">
        <div className="notice-page-hero-copy">
          <p className="section-kicker" style={{ paddingBottom: "5px" }}>Notice</p>
          <h1 className="section-title">공지사항</h1>
        </div>
        <div className="notice-page-meta-chip">
          <span>전체 공지</span>
          <strong>{notices.length}</strong>
        </div>
      </section>

      <section className="surface-card admin-card-stack notice-page-shell">
        {loading ? <LoadingScreen mode="inline" title="공지사항 로딩 중" message="최신 공지를 불러오고 있습니다." /> : null}
        {error ? (
          <p className="feedback-copy is-error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && notices.length === 0 ? (
          <section className="admin-empty-state">
            <p className="section-kicker">Empty</p>
            <h2 className="section-subtitle">아직 등록된 공지사항이 없습니다.</h2>
          </section>
        ) : null}

        {!loading && !error && notices.length > 0 ? (
          <div className="notice-list-grid">
            {notices.map((notice) => (
              <Link className="notice-list-card" key={notice.id} to={`/notices/${notice.id}`}>
                {notice.thumbnailImageUrl ? (
                  <div className="notice-list-card-image">
                    <img src={notice.thumbnailImageUrl} alt={notice.title} loading="lazy" />
                  </div>
                ) : null}
                <div className="notice-list-card-body">
                  <span className="notice-list-card-date">{formatNoticeDate(notice.publishedAt)}</span>
                  <strong className="notice-list-card-title">
                    {notice.isPinned ? <PinIcon /> : null}
                    <span>{notice.title}</span>
                  </strong>
                  <p>{notice.summary || '상세 공지에서 내용을 확인해주세요.'}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
