export const REFUND_POLICY_CONSENT_VERSION = 'custom_order_refund_policy_v1';

export const REFUND_POLICY_CONSENT_MESSAGE =
  '본 상품은 주문 접수 후 개별 제작되는 상품으로,\n제작 시작 후 단순 변심으로 인한 취소/환불/변경이 불가능합니다.';

export type RefundPolicyConsentPayload = {
  agreed: true;
  version: typeof REFUND_POLICY_CONSENT_VERSION;
};

export function buildRefundPolicyConsentPayload(): RefundPolicyConsentPayload {
  return {
    agreed: true,
    version: REFUND_POLICY_CONSENT_VERSION,
  };
}
