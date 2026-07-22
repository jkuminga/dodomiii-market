import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AdminHomeItem, HomeItemSection, apiClient } from '../../lib/api';
import { formatAdminDateTime } from './adminUtils';

const HOME_ITEM_SECTION_LABELS: Record<HomeItemSection, string> = {
  NEW_ARRIVAL: 'NEW',
  BEST: 'BEST',
};

const HOME_ITEM_SECTION_ORDER: Record<HomeItemSection, number> = {
  NEW_ARRIVAL: 0,
  BEST: 1,
};

function getHomeItemTitle(item: AdminHomeItem) {
  return item.title?.trim() || item.productName || `Home Item #${item.id}`;
}

export function AdminHomeItemsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminHomeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        const sectionCompare = HOME_ITEM_SECTION_ORDER[left.section] - HOME_ITEM_SECTION_ORDER[right.section];
        if (sectionCompare !== 0) {
          return sectionCompare;
        }
        const sortCompare = left.sortOrder - right.sortOrder;
        return sortCompare !== 0 ? sortCompare : left.id - right.id;
      }),
    [items],
  );

  const loadItems = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await apiClient.getAdminHomeItems();
      setItems(result.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '홈 아이템 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, []);

  const inactiveCount = items.filter((item) => !item.isActive).length;
  const newArrivalCount = items.filter((item) => item.section === 'NEW_ARRIVAL').length;
  const bestCount = items.filter((item) => item.section === 'BEST').length;
  const hiddenProductCount = items.filter((item) => !item.productIsVisible || item.productDeletedAt).length;
  const latestItem = [...items].sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0] ?? null;

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Home Items</p>
          <h2 className="section-title admin-section-title">홈 아이템 관리</h2>
        </div>

        <div className="admin-stat-grid admin-home-popup-stat-grid">
          <div className="admin-stat-card">
            <span>총 항목</span>
            <strong>{items.length}</strong>
          </div>
          <div className="admin-stat-card">
            <span>NEW</span>
            <strong>{newArrivalCount}</strong>
          </div>
          <div className="admin-stat-card">
            <span>BEST</span>
            <strong>{bestCount}</strong>
          </div>
          <div className="admin-stat-card">
            <span>최근 수정</span>
            <strong>{formatAdminDateTime(latestItem?.updatedAt)}</strong>
          </div>
        </div>
      </section>

      <section className="surface-card admin-card-stack admin-accounts-panel admin-home-popup-list-panel">
        <div className="admin-section-head">
          <div>
            <p className="section-kicker">List</p>
            <h3 className="section-subtitle">홈 아이템 목록</h3>
          </div>

          <div className="inline-actions admin-accounts-actions">
            <button className="button button-ghost" type="button" onClick={() => void loadItems()} disabled={loading}>
              새로고침
            </button>
            <button className="button" type="button" onClick={() => navigate('/admin/home-items/new')}>
              항목 추가
            </button>
          </div>
        </div>

        {loading ? <p className="feedback-copy">홈 아이템 목록을 불러오는 중입니다.</p> : null}
        {error ? (
          <p className="feedback-copy is-error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && sortedItems.length === 0 ? (
          <section className="admin-empty-state">
            <p className="section-kicker">Empty</p>
            <h4 className="section-subtitle">등록된 홈 아이템이 없습니다</h4>
            <p className="section-copy">항목을 추가하면 프로토타입 홈의 NEW 또는 BEST 섹션에 노출할 수 있습니다.</p>
          </section>
        ) : null}

        {!loading && !error && sortedItems.length > 0 ? (
          <>
            <div className="admin-accounts-table-shell">
              <table className="admin-accounts-table admin-home-popup-table">
                <thead>
                  <tr>
                    <th scope="col">이미지</th>
                    <th scope="col">섹션</th>
                    <th scope="col">제목 / 상품</th>
                    <th scope="col">상태</th>
                    <th scope="col">순서</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/admin/home-items/${item.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div className="admin-home-popup-list-thumb">
                          {item.imageUrl || item.productThumbnailImageUrl ? (
                            <img src={item.imageUrl || item.productThumbnailImageUrl || ''} alt={`${getHomeItemTitle(item)} 이미지`} loading="lazy" />
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <span className="admin-accounts-badge is-primary">{HOME_ITEM_SECTION_LABELS[item.section]}</span>
                      </td>
                      <td>
                        <div className="admin-home-popup-title-cell">
                          <strong style={{ fontWeight: 800 }}>{getHomeItemTitle(item)}</strong>
                          <span>{item.productName}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`admin-accounts-badge ${item.isActive ? 'is-active' : 'is-inactive'}`}>
                          {item.isActive ? '노출' : '숨김'}
                        </span>
                        {!item.productIsVisible || item.productDeletedAt ? (
                          <span className="admin-accounts-badge is-muted">상품 비노출</span>
                        ) : null}
                      </td>
                      <td>
                        <div className="admin-home-popup-link-cell">
                          <span className="admin-accounts-badge admin-home-popup-url-badge is-primary">{item.sortOrder}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-accounts-mobile-list">
              {sortedItems.map((item) => (
                <Link className="admin-list-card admin-home-popup-mobile-card" key={`mobile-${item.id}`} to={`/admin/home-items/${item.id}`}>
                  <div className="admin-home-popup-mobile-media">
                    {item.imageUrl || item.productThumbnailImageUrl ? (
                      <img src={item.imageUrl || item.productThumbnailImageUrl || ''} alt={`${getHomeItemTitle(item)} 이미지`} loading="lazy" />
                    ) : null}
                  </div>

                  <div className="admin-list-card-head">
                    <div className="admin-accounts-mobile-head">
                      <strong>{getHomeItemTitle(item)}</strong>
                      <p>{item.productName}</p>
                    </div>
                    <div className="admin-pill-row">
                      <span className="admin-accounts-badge is-primary">{HOME_ITEM_SECTION_LABELS[item.section]}</span>
                      <span className={`admin-accounts-badge ${item.isActive ? 'is-active' : 'is-inactive'}`}>
                        {item.isActive ? '노출' : '숨김'}
                      </span>
                      <span className="admin-accounts-badge is-primary">순서 {item.sortOrder}</span>
                    </div>
                  </div>

                  <dl className="admin-accounts-mobile-grid">
                    <div>
                      <dt>수정일</dt>
                      <dd>{formatAdminDateTime(item.updatedAt)}</dd>
                    </div>
                    <div>
                      <dt>상품 ID</dt>
                      <dd>{item.productId}</dd>
                    </div>
                  </dl>
                </Link>
              ))}
            </div>
          </>
        ) : null}

        {!loading && !error && inactiveCount > 0 ? <p className="admin-inline-note">숨김 항목 {inactiveCount}개가 목록에 포함되어 있습니다.</p> : null}
        {!loading && !error && hiddenProductCount > 0 ? <p className="admin-inline-note">상품 확인 필요 항목 {hiddenProductCount}개가 목록에 포함되어 있습니다.</p> : null}
      </section>
    </section>
  );
}
