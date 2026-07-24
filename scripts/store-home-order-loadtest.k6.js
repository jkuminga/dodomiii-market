import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
const PRODUCT_ID = Number(__ENV.PRODUCT_ID || 0);
const ORDER_RATIO = Number(__ENV.ORDER_RATIO || 0.05);
const TEST_TAG = __ENV.TEST_TAG || 'LOADTEST';
const SLEEP_SECONDS = Number(__ENV.SLEEP_SECONDS || 1);
const REFUND_POLICY_CONSENT_VERSION =
  __ENV.REFUND_POLICY_CONSENT_VERSION || 'custom_order_refund_policy_v1';

const SELECTED_OPTIONS = parseSelectedOptions(__ENV.SELECTED_OPTIONS);

export const options = {
  stages: [
    { duration: '2m', target: 8 },
    { duration: '5m', target: 25 },
    { duration: '10m', target: 75 },
    { duration: '10m', target: 125 },
    { duration: '3m', target: 200 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
    'http_req_duration{flow:order-create}': ['p(95)<2000'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  loadHome();
  sleep(SLEEP_SECONDS);
}

function loadHome() {
  const responses = http.batch([
    ['GET', `${BASE_URL}/store/settings`, null, { tags: { flow: 'home', endpoint: 'settings' } }],
    ['GET', `${BASE_URL}/store/categories`, null, { tags: { flow: 'home', endpoint: 'categories' } }],
    [
      'GET',
      `${BASE_URL}/store/products?sort=latest&size=4`,
      null,
      { tags: { flow: 'home', endpoint: 'products-latest' } },
    ],
    ['GET', `${BASE_URL}/store/home-hero`, null, { tags: { flow: 'home', endpoint: 'home-hero' } }],
    ['GET', `${BASE_URL}/store/home-popup`, null, { tags: { flow: 'home', endpoint: 'home-popup' } }],
  ]);

  check(responses[0], {
    'settings returns 200': (res) => res.status === 200,
    'settings success true': (res) => res.json('success') === true,
  });
  check(responses[1], {
    'categories returns 200': (res) => res.status === 200,
    'categories success true': (res) => res.json('success') === true,
  });
  check(responses[2], {
    'products returns 200': (res) => res.status === 200,
    'products success true': (res) => res.json('success') === true,
    'products items array': (res) => Array.isArray(res.json('data.items')),
  });
  check(responses[3], {
    'home hero returns 200': (res) => res.status === 200,
    'home hero success true': (res) => res.json('success') === true,
  });
  check(responses[4], {
    'home popup returns 200': (res) => res.status === 200,
    'home popup success true': (res) => res.json('success') === true,
  });
}

function createOrder() {
  if (!Number.isInteger(PRODUCT_ID) || PRODUCT_ID < 1) {
    throw new Error('PRODUCT_ID env var is required for order-create flow.');
  }

  const suffix = `${Date.now()}-${__VU}-${__ITER}`;
  const buyerName = `${TEST_TAG}_${suffix}`.slice(0, 100);
  const phoneTail = String((__VU * 100000 + __ITER) % 100000000).padStart(8, '0');

  const item = {
    productId: PRODUCT_ID,
    quantity: 1,
  };

  if (SELECTED_OPTIONS.length > 0) {
    item.selectedOptions = SELECTED_OPTIONS;
  }

  const payload = {
    items: [item],
    contact: {
      buyerName,
      buyerPhone: `010${phoneTail}`,
      receiverName: buyerName,
      receiverPhone: `010${phoneTail}`,
      zipcode: '06000',
      address1: '서울특별시 강남구 테스트로 1',
      address2: 'k6 production load test',
    },
    refundPolicyConsent: {
      agreed: true,
      version: REFUND_POLICY_CONSENT_VERSION,
    },
    customerRequest: `[${TEST_TAG}] k6 production transaction-mode test`,
  };

  const response = http.post(`${BASE_URL}/store/orders`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    tags: { flow: 'order-create', endpoint: 'orders' },
  });

  check(response, {
    'order returns 200 or 201': (res) => res.status === 200 || res.status === 201,
    'order success true': (res) => res.json('success') === true,
    'orderNumber exists': (res) => Boolean(res.json('data.orderNumber')),
  });
}

function parseSelectedOptions(rawValue) {
  if (!rawValue) {
    return [];
  }

  const parsed = JSON.parse(rawValue);
  if (!Array.isArray(parsed)) {
    throw new Error('SELECTED_OPTIONS must be a JSON array.');
  }

  return parsed.map((option) => ({
    productOptionGroupId: Number(option.productOptionGroupId),
    productOptionId: Number(option.productOptionId),
    quantity: Number(option.quantity || 1),
  }));
}
