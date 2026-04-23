import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom';

import { AdminAccount, AdminRole, apiClient } from '../../lib/api';
import { AdminLayoutContext } from './adminUtils';

type AccountFormState = {
  loginId: string;
  password: string;
  name: string;
  email: string;
  phone: string;
  role: AdminRole;
  isActive: boolean;
  depositBankName: string;
  depositAccountHolder: string;
  depositAccountNumber: string;
  isPrimaryDepositAccount: boolean;
};

const INITIAL_FORM: AccountFormState = {
  loginId: '',
  password: '',
  name: '',
  email: '',
  phone: '',
  role: 'STAFF',
  isActive: true,
  depositBankName: '',
  depositAccountHolder: '',
  depositAccountNumber: '',
  isPrimaryDepositAccount: false,
};

function toForm(account: AdminAccount): AccountFormState {
  return {
    loginId: account.loginId,
    password: '',
    name: account.name,
    email: account.email ?? '',
    phone: account.phone ?? '',
    role: account.role,
    isActive: account.isActive,
    depositBankName: account.depositBankName ?? '',
    depositAccountHolder: account.depositAccountHolder ?? '',
    depositAccountNumber: account.depositAccountNumber ?? '',
    isPrimaryDepositAccount: account.isPrimaryDepositAccount,
  };
}

export function AdminAccountFormPage() {
  const navigate = useNavigate();
  const params = useParams<{ adminId?: string }>();
  const { admin, showToast } = useOutletContext<AdminLayoutContext>();
  const isEditMode = Boolean(params.adminId);
  const editAdminId = Number(params.adminId ?? 0);

  const [form, setForm] = useState<AccountFormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isEditMode || !Number.isFinite(editAdminId) || editAdminId <= 0) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');

      try {
        const result = await apiClient.getAdminAccounts();
        if (cancelled) {
          return;
        }

        const target = result.items.find((item) => item.adminId === editAdminId);
        if (!target) {
          setError('수정할 관리자 계정을 찾을 수 없습니다.');
          return;
        }

        setForm(toForm(target));
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : '관리자 계정 정보를 불러오지 못했습니다.');
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
  }, [editAdminId, isEditMode]);

  if (admin.role !== 'SUPER') {
    return <Navigate to="/admin/categories" replace />;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!form.loginId.trim() || !form.name.trim()) {
      showToast('아이디와 이름을 입력해주세요.', 'error');
      return;
    }

    if (!isEditMode && form.password.trim().length < 8) {
      showToast('비밀번호는 8자 이상 입력해주세요.', 'error');
      return;
    }

    setSaving(true);

    try {
      if (isEditMode) {
        await apiClient.updateAdminAccount(editAdminId, {
          loginId: form.loginId.trim(),
          name: form.name.trim(),
          role: form.role,
          isActive: form.isActive,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          depositBankName: form.depositBankName.trim() || null,
          depositAccountHolder: form.depositAccountHolder.trim() || null,
          depositAccountNumber: form.depositAccountNumber.trim() || null,
          isPrimaryDepositAccount: form.isPrimaryDepositAccount,
          ...(form.password.trim() ? { password: form.password } : {}),
        });
        showToast('관리자 계정 정보를 수정했습니다.');
      } else {
        await apiClient.createAdminAccount({
          loginId: form.loginId.trim(),
          password: form.password,
          name: form.name.trim(),
          role: form.role,
          isActive: form.isActive,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          depositBankName: form.depositBankName.trim() || null,
          depositAccountHolder: form.depositAccountHolder.trim() || null,
          depositAccountNumber: form.depositAccountNumber.trim() || null,
          isPrimaryDepositAccount: form.isPrimaryDepositAccount,
        });
        showToast('관리자 계정을 생성했습니다.');
      }

      navigate('/admin/accounts');
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : '관리자 계정 처리 중 오류가 발생했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Accounts</p>
          <h2 className="section-title admin-section-title">{isEditMode ? '관리자 계정 수정' : '관리자 계정 생성'}</h2>
        </div>
      </section>

      <form className="surface-card admin-card-stack admin-filter-panel" onSubmit={onSubmit}>
        <div className="admin-section-head">
          <div>
            <p className="section-kicker">Form</p>
            <h3 className="section-subtitle">{isEditMode ? '수정 정보 입력' : '신규 계정 정보 입력'}</h3>
          </div>
        </div>

        {loading ? <p className="feedback-copy">계정 정보를 불러오는 중입니다.</p> : null}
        {error ? (
          <p className="feedback-copy is-error" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error ? (
          <>
            <div className="admin-field-grid">
              <label className="field">
                <span>로그인 아이디</span>
                <input
                  value={form.loginId}
                  onChange={(event) => setForm((current) => ({ ...current, loginId: event.target.value }))}
                  autoComplete="off"
                  required
                />
              </label>

              <label className="field">
                <span>이름</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  autoComplete="off"
                  required
                />
              </label>

              <label className="field">
                <span>비밀번호 {isEditMode ? '(변경 시 입력)' : ''}</span>
                <input
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                  type="password"
                  autoComplete="new-password"
                  required={!isEditMode}
                />
              </label>

              <label className="field">
                <span>권한</span>
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value === 'SUPER' ? 'SUPER' : 'STAFF',
                    }))
                  }
                >
                  <option value="STAFF">STAFF</option>
                  <option value="SUPER">SUPER</option>
                </select>
              </label>

              <label className="field">
                <span>이메일</span>
                <input
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  type="email"
                  autoComplete="off"
                />
              </label>

              <label className="field">
                <span>연락처</span>
                <input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  autoComplete="off"
                />
              </label>
            </div>

            <div className="admin-field-grid">
              <label className="field">
                <span>입금 은행명</span>
                <input
                  value={form.depositBankName}
                  onChange={(event) => setForm((current) => ({ ...current, depositBankName: event.target.value }))}
                  autoComplete="off"
                />
              </label>

              <label className="field">
                <span>예금주</span>
                <input
                  value={form.depositAccountHolder}
                  onChange={(event) => setForm((current) => ({ ...current, depositAccountHolder: event.target.value }))}
                  autoComplete="off"
                />
              </label>

              <label className="field">
                <span>계좌번호</span>
                <input
                  value={form.depositAccountNumber}
                  onChange={(event) => setForm((current) => ({ ...current, depositAccountNumber: event.target.value }))}
                  autoComplete="off"
                />
              </label>
            </div>

            <div className="admin-field-grid">
              <label className="field">
                <span>계정 상태</span>
                <select
                  value={form.isActive ? 'active' : 'inactive'}
                  onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === 'active' }))}
                >
                  <option value="active">활성</option>
                  <option value="inactive">비활성</option>
                </select>
              </label>

              <label className="field">
                <span>대표 입금계좌 노출</span>
                <select
                  value={form.isPrimaryDepositAccount ? 'yes' : 'no'}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isPrimaryDepositAccount: event.target.value === 'yes',
                    }))
                  }
                >
                  <option value="no">아니오</option>
                  <option value="yes">예</option>
                </select>
              </label>
            </div>

            <div className="inline-actions">
              <button className="button" type="submit" disabled={saving}>
                {saving ? '처리 중...' : isEditMode ? '저장' : '계정 생성'}
              </button>
              <button className="button button-secondary" type="button" onClick={() => navigate('/admin/accounts')} disabled={saving}>
                목록으로
              </button>
            </div>
          </>
        ) : null}
      </form>
    </section>
  );
}
