import { FormEvent, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';

import { AdminFloatingSubmitButton } from '../../components/admin/AdminFloatingSubmitButton';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { AdminShippingSettings, apiClient } from '../../lib/api';
import { AdminLayoutContext, formatAdminDateTime } from './adminUtils';

type ShippingSettingsFormState = {
  baseShippingFee: string;
  jejuAdditionalFee: string;
  islandAdditionalFee: string;
  freeShippingEnabled: boolean;
  freeShippingThreshold: string;
};

const FLOATING_SUBMIT_SUCCESS_MS = 700;

function toFormState(settings: AdminShippingSettings): ShippingSettingsFormState {
  return {
    baseShippingFee: String(settings.baseShippingFee),
    jejuAdditionalFee: String(settings.jejuAdditionalFee),
    islandAdditionalFee: String(settings.islandAdditionalFee),
    freeShippingEnabled: settings.freeShippingEnabled,
    freeShippingThreshold: String(settings.freeShippingThreshold),
  };
}

export function AdminShippingSettingsPage() {
  const { showToast } = useOutletContext<AdminLayoutContext>();
  const [settings, setSettings] = useState<AdminShippingSettings | null>(null);
  const [form, setForm] = useState<ShippingSettingsFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    apiClient.getAdminShippingSettings()
      .then((result) => {
        if (!active) return;
        setSettings(result);
        setForm(toFormState(result));
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : '배송비 설정을 불러오지 못했습니다.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const updateField = <Key extends keyof ShippingSettingsFormState>(key: Key, value: ShippingSettingsFormState[Key]) => {
    setForm((current) => current ? { ...current, [key]: value } : current);
    if (error !== '') setError('');
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;

    const baseShippingFee = Number(form.baseShippingFee);
    const jejuAdditionalFee = Number(form.jejuAdditionalFee);
    const islandAdditionalFee = Number(form.islandAdditionalFee);
    const freeShippingThreshold = Number(form.freeShippingThreshold);

    if (![baseShippingFee, jejuAdditionalFee, islandAdditionalFee, freeShippingThreshold].every((value) => Number.isSafeInteger(value) && value >= 0)) {
      setError('배송비와 기준 금액은 0원 이상의 정수로 입력해주세요.');
      return;
    }

    if (form.freeShippingEnabled && freeShippingThreshold <= 0) {
      setError('무료배송을 활성화할 때는 기준 금액을 1원 이상 입력해주세요.');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    setError('');

    try {
      const result = await apiClient.updateAdminShippingSettings({
        baseShippingFee,
        jejuAdditionalFee,
        islandAdditionalFee,
        freeShippingEnabled: form.freeShippingEnabled,
        freeShippingThreshold,
      });
      setSettings(result);
      setForm(toFormState(result));
      showToast('배송비 설정을 저장했습니다.');
      setSaveSuccess(true);
      await new Promise((resolve) => window.setTimeout(resolve, FLOATING_SUBMIT_SUCCESS_MS));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '배송비 설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
      setSaveSuccess(false);
    }
  };

  return (
    <section className="admin-section">
      <section className="surface-hero compact-hero admin-hero-card">
        <div className="admin-hero-copy">
          <p className="section-kicker">Shipping Policy</p>
          <h2 className="section-title admin-section-title">배송비 설정</h2>
          <p className="section-copy section-copy-compact">기본 배송비와 지역별 추가금, 무료배송 기준을 관리합니다.</p>
        </div>
        <div className="admin-stat-grid">
          <div className="admin-stat-card">
            <span>최근 수정</span>
            <strong>{loading ? '확인 중' : formatAdminDateTime(settings?.updatedAt)}</strong>
          </div>
        </div>
      </section>

      <form className="surface-card admin-card-stack admin-home-section-card admin-storefront-settings-form" onSubmit={onSubmit} aria-busy={loading || saving}>
        <AdminFloatingSubmitButton busy={saving} busyLabel="저장 중..." disabled={saving || !form} label="배송비 설정 저장" success={saveSuccess} />
        <div className="admin-section-head">
          <div>
            <h3 className="section-subtitle">배송 정책</h3>
            <p className="section-copy section-copy-compact">
              무료배송 기준은 할인·옵션이 반영된 최종 상품 금액이며, 제주·도서산간 추가금은 무료배송 이후에도 유지됩니다.
            </p>
          </div>
          <button className="button" type="submit" disabled={saving || !form}>{saving ? '저장 중...' : '저장'}</button>
        </div>

        {error !== '' ? <p className="feedback-copy is-error" role="alert">{error}</p> : null}

        {loading ? (
          <LoadingScreen mode="inline" title="배송비 설정 로딩 중" message="배송 정책을 불러오고 있습니다." />
        ) : form ? (
          <div className="admin-field-grid">
            <label className="field">
              <span>기본 배송비 (원)</span>
              <input type="number" min="0" step="100" value={form.baseShippingFee} onChange={(event) => updateField('baseShippingFee', event.target.value)} required />
            </label>
            <label className="field">
              <span>제주도 추가금 (원)</span>
              <input type="number" min="0" step="100" value={form.jejuAdditionalFee} onChange={(event) => updateField('jejuAdditionalFee', event.target.value)} required />
            </label>
            <label className="field">
              <span>도서산간 추가금 (원)</span>
              <input type="number" min="0" step="100" value={form.islandAdditionalFee} onChange={(event) => updateField('islandAdditionalFee', event.target.value)} required />
            </label>
            <label className="field">
              <span>무료배송 기준 금액 (원)</span>
              <input type="number" min="0" step="100" value={form.freeShippingThreshold} onChange={(event) => updateField('freeShippingThreshold', event.target.value)} required />
            </label>
            <label className="order-inline-checkbox" style={{ gridColumn: '1 / -1' }}>
              <input type="checkbox" checked={form.freeShippingEnabled} onChange={(event) => updateField('freeShippingEnabled', event.target.checked)} />
              <span>무료배송 정책 활성화</span>
            </label>
          </div>
        ) : null}
      </form>
    </section>
  );
}
