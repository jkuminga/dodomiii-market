import { FormEvent, useEffect, useState } from 'react';
import { Link, Location, useLocation, useNavigate } from 'react-router-dom';

import { apiClient } from '../../lib/api';

type LoginLocationState = {
  from?: Location;
  reason?: string;
};

function resolveAdminDestination(state: LoginLocationState | null | undefined): string {
  const pathname = state?.from?.pathname;

  if (pathname && pathname.startsWith('/admin') && pathname !== '/admin/login') {
    return pathname + (state?.from?.search ?? '');
  }

  return '/admin/categories';
}

export function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LoginLocationState | null) ?? null;

  const [checkingSession, setCheckingSession] = useState(true);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(state?.reason ?? '');

  const redirectTo = resolveAdminDestination(state);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        await apiClient.me();

        if (!cancelled) {
          navigate(redirectTo, { replace: true });
        }
      } catch {
        if (!cancelled) {
          setCheckingSession(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [navigate, redirectTo]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await apiClient.login(loginId.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '로그인 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="admin-login-page">
        <section className="surface-card status-card">
          <p className="section-kicker">Admin Access</p>
          <h1 className="section-subtitle">세션 확인 중</h1>
          <p className="feedback-copy">로그인된 운영 계정이 있는지 먼저 확인하고 있습니다.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-login-page">
      <section className="surface-hero compact-hero admin-login-hero">
        <p className="section-kicker">Admin Access</p>
        <h1 className="section-title">관리자 로그인</h1>
        <p className="section-copy">운영자 세션을 확인한 뒤 카테고리와 상품 관리 화면으로 바로 연결합니다.</p>
      </section>

      <form className="surface-card form-panel admin-login-card" onSubmit={onSubmit}>
        <label className="field">
          <span>아이디</span>
          <input value={loginId} onChange={(event) => setLoginId(event.target.value)} placeholder="admin" autoComplete="username" />
        </label>

        <label className="field">
          <span>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호 입력"
            autoComplete="current-password"
          />
        </label>

        {error ? (
          <p className="feedback-copy is-error" role="alert">
            {error}
          </p>
        ) : null}

        <button className="button button-block" type="submit" disabled={submitting || !loginId.trim() || !password}>
          {submitting ? '로그인 중...' : '로그인'}
        </button>

        <Link className="button-text admin-login-home-link" to="/">
          홈으로 돌아가기
        </Link>
      </form>
    </main>
  );
}
