import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useOutletContext } from 'react-router-dom';

import { AdminAccount, apiClient } from '../../lib/api';
import { AdminLayoutContext, formatAdminDateTime, formatAdminPhone } from './adminUtils';

export function AdminAccountsPage() {
  const navigate = useNavigate();
  const { admin, showToast } = useOutletContext<AdminLayoutContext>();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const sortedAccounts = useMemo(
    () =>
      [...accounts].sort((left, right) => {
        if (left.role !== right.role) {
          return left.role === 'SUPER' ? -1 : 1;
        }

        return left.adminId - right.adminId;
      }),
    [accounts],
  );

  const loadAccounts = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await apiClient.getAdminAccounts();
      setAccounts(result.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '관리자 계정 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAccounts();
  }, []);

  if (admin.role !== 'SUPER') {
    return <Navigate to="/admin/categories" replace />;
  }

  const onDelete = async (account: AdminAccount) => {
    if (deletingId !== null) {
      return;
    }

    const confirmed = window.confirm(`${account.name}(${account.loginId}) 계정을 삭제할까요?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(account.adminId);

    try {
      await apiClient.deleteAdminAccount(account.adminId);
      showToast('관리자 계정을 삭제했습니다.');
      await loadAccounts();
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : '계정 삭제에 실패했습니다.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const activeAccountCount = accounts.filter((item) => item.isActive).length;
  const hasPrimaryDepositAccount = accounts.some((item) => item.isPrimaryDepositAccount);

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Accounts</p>
          <h2 className="section-title admin-section-title">관리자 계정 관리</h2>
        </div>

        <div className="admin-stat-grid">
          <div className="admin-stat-card">
            <span>총 계정</span>
            <strong>{accounts.length}</strong>
          </div>
          <div className="admin-stat-card">
            <span>활성 계정</span>
            <strong>{activeAccountCount}</strong>
          </div>
          <div className="admin-stat-card">
            <span>대표 계좌</span>
            <strong>{hasPrimaryDepositAccount ? '설정됨' : '미설정'}</strong>
          </div>
        </div>
      </section>

      <section className="surface-card admin-card-stack admin-accounts-panel">
        <div className="admin-section-head">
          <div>
            <p className="section-kicker">List</p>
            <h3 className="section-subtitle">관리자 계정 목록</h3>
            <p className="section-copy admin-accounts-copy">
              권한, 상태, 대표 입금계좌 설정을 한 화면에서 빠르게 확인하고 관리합니다.
            </p>
          </div>

          <div className="inline-actions admin-accounts-actions">
            <button className="button button-ghost" type="button" onClick={() => void loadAccounts()} disabled={loading}>
              새로고침
            </button>
            <button className="button" type="button" onClick={() => navigate('/admin/accounts/new')}>
              + 관리자 계정 생성
            </button>
          </div>
        </div>

        {loading ? <p className="feedback-copy">관리자 계정을 불러오는 중입니다.</p> : null}
        {error ? (
          <p className="feedback-copy is-error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && sortedAccounts.length === 0 ? (
          <p className="feedback-copy">등록된 관리자 계정이 없습니다.</p>
        ) : null}

        {!loading && !error && sortedAccounts.length > 0 ? (
          <>
            <div className="admin-accounts-table-shell">
              <table className="admin-accounts-table">
                <thead>
                  <tr>
                    <th scope="col">이름</th>
                    <th scope="col">아이디</th>
                    <th scope="col">권한</th>
                    <th scope="col">상태</th>
                    <th scope="col">대표계좌</th>
                    <th scope="col">연락처</th>
                    <th scope="col">수정일</th>
                    <th scope="col">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAccounts.map((account) => (
                    <tr key={account.adminId}>
                      <td>
                        <div className="admin-accounts-name-cell">
                          <strong>{account.name}</strong>
                          <span>{account.email ?? '이메일 미등록'}</span>
                        </div>
                      </td>
                      <td>
                        <code className="admin-accounts-inline-code">{account.loginId}</code>
                      </td>
                      <td>
                        <span className={`admin-accounts-badge ${account.role === 'SUPER' ? 'is-super' : 'is-staff'}`}>
                          {account.role}
                        </span>
                      </td>
                      <td>
                        <span className={`admin-accounts-badge ${account.isActive ? 'is-active' : 'is-inactive'}`}>
                          {account.isActive ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`admin-accounts-badge ${account.isPrimaryDepositAccount ? 'is-primary' : 'is-muted'}`}
                        >
                          {account.isPrimaryDepositAccount ? '대표' : '일반'}
                        </span>
                      </td>
                      <td>{formatAdminPhone(account.phone)}</td>
                      <td>{formatAdminDateTime(account.updatedAt)}</td>
                      <td>
                        <div className="admin-accounts-row-actions">
                          <button
                            className="button button-ghost"
                            type="button"
                            onClick={() => navigate(`/admin/accounts/${account.adminId}/edit`)}
                          >
                            수정
                          </button>
                          <button
                            className="button button-danger"
                            type="button"
                            onClick={() => void onDelete(account)}
                            disabled={deletingId === account.adminId}
                          >
                            {deletingId === account.adminId ? '삭제 중...' : '삭제'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="admin-accounts-mobile-list">
              {sortedAccounts.map((account) => (
                <article className="admin-list-card admin-accounts-mobile-card" key={`mobile-${account.adminId}`}>
                  <div className="admin-list-card-head">
                    <div className="admin-accounts-mobile-head">
                      <strong>{account.name}</strong>
                      <p>{account.loginId}</p>
                    </div>
                    <div className="admin-pill-row">
                      <span className={`admin-accounts-badge ${account.role === 'SUPER' ? 'is-super' : 'is-staff'}`}>
                        {account.role}
                      </span>
                      <span className={`admin-accounts-badge ${account.isActive ? 'is-active' : 'is-inactive'}`}>
                        {account.isActive ? '활성' : '비활성'}
                      </span>
                    </div>
                  </div>

                  <dl className="admin-accounts-mobile-grid">
                    <div>
                      <dt>대표계좌</dt>
                      <dd>{account.isPrimaryDepositAccount ? '대표 계좌' : '일반 계좌'}</dd>
                    </div>
                    <div>
                      <dt>연락처</dt>
                      <dd>{formatAdminPhone(account.phone)}</dd>
                    </div>
                    <div>
                      <dt>수정일</dt>
                      <dd>{formatAdminDateTime(account.updatedAt)}</dd>
                    </div>
                  </dl>

                  <div className="admin-accounts-row-actions">
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() => navigate(`/admin/accounts/${account.adminId}/edit`)}
                    >
                      수정
                    </button>
                    <button
                      className="button button-danger"
                      type="button"
                      onClick={() => void onDelete(account)}
                      disabled={deletingId === account.adminId}
                    >
                      {deletingId === account.adminId ? '삭제 중...' : '삭제'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </section>
  );
}
