import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AdminHomePopup, apiClient } from '../../lib/api';
import { formatAdminDateTime } from './adminUtils';

function getPopupTitle(popup: AdminHomePopup) {
  return popup.title?.trim() || `팝업 #${popup.id}`;
}

export function AdminHomePopupsPage() {
  const navigate = useNavigate();
  const [popups, setPopups] = useState<AdminHomePopup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const sortedPopups = useMemo(
    () =>
      [...popups].sort((left, right) => {
        const updatedCompare = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
        return updatedCompare !== 0 ? updatedCompare : right.id - left.id;
      }),
    [popups],
  );

  const loadPopups = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await apiClient.getAdminHomePopups();
      setPopups(result.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '홈 팝업 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPopups();
  }, []);

  const activePopupCount = popups.filter((popup) => popup.isActive).length;
  const inactivePopupCount = popups.length - activePopupCount;
  const linkedPopupCount = popups.filter((popup) => Boolean(popup.linkUrl?.trim())).length;
  const latestPopup = sortedPopups[0] ?? null;

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Home Popups</p>
          <h2 className="section-title admin-section-title">홈 팝업 관리</h2>
        </div>

        <div className="admin-stat-grid admin-home-popup-stat-grid">
          <div className="admin-stat-card">
            <span>총 팝업</span>
            <strong>{popups.length}</strong>
          </div>
          <div className="admin-stat-card">
            <span>노출 중</span>
            <strong>{activePopupCount}</strong>
          </div>
          <div className="admin-stat-card">
            <span>링크 설정</span>
            <strong>{linkedPopupCount}</strong>
          </div>
          <div className="admin-stat-card">
            <span>최근 수정</span>
            <strong>{formatAdminDateTime(latestPopup?.updatedAt)}</strong>
          </div>
        </div>
      </section>

      <section className="surface-card admin-card-stack admin-accounts-panel admin-home-popup-list-panel">
        <div className="admin-section-head">
          <div>
            <p className="section-kicker">List</p>
            <h3 className="section-subtitle">홈 팝업 목록</h3>
          </div>

          <div className="inline-actions admin-accounts-actions">
            <button className="button button-ghost" type="button" onClick={() => void loadPopups()} disabled={loading}>
              새로고침
            </button>
            <button className="button" type="button" onClick={() => navigate('/admin/home-popups/new')}>
              팝업 추가
            </button>
          </div>
        </div>

        {loading ? <p className="feedback-copy">홈 팝업 목록을 불러오는 중입니다.</p> : null}
        {error ? (
          <p className="feedback-copy is-error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && sortedPopups.length === 0 ? (
          <section className="admin-empty-state">
            <p className="section-kicker">Empty</p>
            <h4 className="section-subtitle">등록된 홈 팝업이 없습니다</h4>
            <p className="section-copy">팝업을 추가하면 사용자 홈 화면 진입 시 노출할 수 있습니다.</p>
          </section>
        ) : null}

        {!loading && !error && sortedPopups.length > 0 ? (
          <>
            <div className="admin-accounts-table-shell">
              <table className="admin-accounts-table admin-home-popup-table">
                <thead>
                  <tr>
                    <th scope="col">이미지</th>
                    <th scope="col">제목</th>
                    <th scope="col">상태</th>
                    <th scope="col">링크</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPopups.map((popup) => (
                    <tr 
                      key={popup.id} 
                      onClick={() => navigate(`/admin/home-popups/${popup.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="admin-home-popup-list-thumb">
                          <img src={popup.imageUrl} alt={`${getPopupTitle(popup)} 이미지`} loading="lazy" />
                        </div>
                      </td>
                      <td>
                        <div className="admin-home-popup-title-cell">
                          <strong style={{ fontWeight: 800 }}>{getPopupTitle(popup)}</strong>
                        </div>
                      </td>
                      <td>
                        <span className={`admin-accounts-badge ${popup.isActive ? 'is-active' : 'is-inactive'}`}>
                          {popup.isActive ? '노출' : '숨김'}
                        </span>
                      </td>
                      <td>
                        <div className="admin-home-popup-link-cell">
                          <span className={`admin-accounts-badge admin-home-popup-url-badge ${popup.linkUrl ? 'is-primary' : 'is-muted'}`}>
                            {popup.linkUrl ? popup.linkUrl : '없음'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-accounts-mobile-list">
              {sortedPopups.map((popup) => (
                <Link className="admin-list-card admin-home-popup-mobile-card" key={`mobile-${popup.id}`} to={`/admin/home-popups/${popup.id}`}>
                  <div className="admin-home-popup-mobile-media">
                    <img src={popup.imageUrl} alt={`${getPopupTitle(popup)} 이미지`} loading="lazy" />
                  </div>

                  <div className="admin-list-card-head">
                    <div className="admin-accounts-mobile-head">
                      <strong>{getPopupTitle(popup)}</strong>
                      <p>팝업 ID {popup.id}</p>
                    </div>
                    <div className="admin-pill-row">
                      <span className={`admin-accounts-badge ${popup.isActive ? 'is-active' : 'is-inactive'}`}>
                        {popup.isActive ? '노출' : '숨김'}
                      </span>
                      <span className={`admin-accounts-badge ${popup.linkUrl ? 'is-primary' : 'is-muted'}`}>
                        {popup.linkUrl ? '링크' : '링크 없음'}
                      </span>
                    </div>
                  </div>

                  <dl className="admin-accounts-mobile-grid">
                    <div>
                      <dt>수정일</dt>
                      <dd>{formatAdminDateTime(popup.updatedAt)}</dd>
                    </div>
                    <div>
                      <dt>링크 URL</dt>
                      <dd>{popup.linkUrl ?? '미설정'}</dd>
                    </div>
                  </dl>
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </section>
  );
}
