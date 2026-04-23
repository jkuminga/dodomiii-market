import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { LoadingScreen } from '../../components/common/LoadingScreen';
import { StoreNoticeDetail, apiClient } from '../../lib/api';

function formatNoticeDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function NoticeDetailPage() {
  const { noticeId } = useParams<{ noticeId: string }>();

  const [notice, setNotice] = useState<StoreNoticeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!noticeId) {
        setError('공지사항 번호가 올바르지 않습니다.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const result = await apiClient.getStoreNoticeById(noticeId);

        if (!cancelled) {
          setNotice(result);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '공지사항을 불러오지 못했습니다.');
          setNotice(null);
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
  }, [noticeId]);

  return (
    <main className="m-page">
      <section className="surface-card admin-card-stack notice-page-shell notice-detail-shell">
        {loading ? <LoadingScreen mode="inline" title="공지사항 로딩 중" message="공지 상세를 불러오고 있습니다." /> : null}
        {error ? (
          <p className="feedback-copy is-error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && notice ? (
          <article className="notice-detail-article">
            <header className="notice-detail-header">
              <div className="notice-detail-header-top">
                <div className="notice-detail-header-copy">
                  <p className="section-kicker notice-detail-kicker">Notice</p>
                  <h1 className="section-title notice-detail-title">{notice.title}</h1>
                  <div className="notice-detail-meta">
                    <span>{formatNoticeDate(notice.publishedAt)}</span>
                  </div>
                  {notice.summary ? <p className="section-copy notice-detail-summary">{notice.summary}</p> : null}
                </div>
                <Link className="button button-secondary notice-detail-back-button" to="/notices">
                  목록으로
                </Link>
              </div>
            </header>

            <div className="notice-detail-body">
              {notice.contentJson.blocks.map((block, index) =>
                block.type === 'text' ? (
                  <p className="notice-detail-text" key={`${block.type}-${index}`}>
                    {block.text}
                  </p>
                ) : (
                  <figure className="notice-detail-image" key={`${block.type}-${index}`}>
                    <img src={block.imageUrl} alt={block.alt || notice.title} loading="lazy" />
                    {block.caption ? <figcaption>{block.caption}</figcaption> : null}
                  </figure>
                ),
              )}
            </div>
          </article>
        ) : null}
      </section>
    </main>
  );
}
