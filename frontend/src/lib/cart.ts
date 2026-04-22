import { useEffect, useState } from 'react';

const CART_STORAGE_KEY = 'dodomi.cart.v1';
const CART_PERSIST_MS = 7 * 24 * 60 * 60 * 1000;

export type CartSelectedOption = {
  groupId: number;
  groupName: string;
  optionId: number;
  optionName: string;
  quantity: number;
  extraPrice: number;
};

export type CartItem = {
  id: string;
  productId: number;
  productName: string;
  categoryName: string;
  thumbnailImageUrl: string | null;
  basePrice: number;
  productQuantity: number;
  selectedOptions: CartSelectedOption[];
  createdAt: string;
  updatedAt: string;
};

type StoredCart = {
  expiresAt: number;
  items: CartItem[];
};

type CartSnapshot = {
  items: CartItem[];
  itemCount: number;
};

const CART_CHANGE_EVENT = 'dodomi:cart-changed';
const EMPTY_CART_SNAPSHOT: CartSnapshot = {
  items: [],
  itemCount: 0,
};

function sortSelectedOptions(selectedOptions: CartSelectedOption[]): CartSelectedOption[] {
  return [...selectedOptions].sort((left, right) => {
    if (left.groupId !== right.groupId) {
      return left.groupId - right.groupId;
    }

    if (left.optionId !== right.optionId) {
      return left.optionId - right.optionId;
    }

    return left.quantity - right.quantity;
  });
}

function buildCartItemId(productId: number, selectedOptions: CartSelectedOption[]): string {
  const signature = sortSelectedOptions(selectedOptions)
    .map((option) => `${option.groupId}:${option.optionId}:${option.quantity}`)
    .join(';');

  return signature ? `${productId}:${signature}` : `${productId}:default`;
}

function notifyCartChange() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(CART_CHANGE_EVENT));
}

function clearStoredCart() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // Ignore storage access failures so the app can still render.
  }
}

function readStoredCartPayload(): { items: CartItem[]; storageKey: string } {
  if (typeof window === 'undefined') {
    return { items: [], storageKey: 'server' };
  }

  let raw: string | null = null;

  try {
    raw = window.localStorage.getItem(CART_STORAGE_KEY);
  } catch {
    return { items: [], storageKey: 'storage-error' };
  }

  if (!raw) {
    return { items: [], storageKey: 'empty' };
  }

  try {
    const parsed = JSON.parse(raw) as StoredCart;
    if (!parsed || !Array.isArray(parsed.items) || typeof parsed.expiresAt !== 'number') {
      clearStoredCart();
      return { items: [], storageKey: 'invalid' };
    }

    if (parsed.expiresAt <= Date.now()) {
      clearStoredCart();
      return { items: [], storageKey: 'expired' };
    }

    return { items: parsed.items, storageKey: raw };
  } catch {
    clearStoredCart();
    return { items: [], storageKey: 'parse-error' };
  }
}

function writeStoredCart(items: CartItem[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: StoredCart = {
    expiresAt: Date.now() + CART_PERSIST_MS,
    items,
  };

  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    return;
  }

  notifyCartChange();
}

function getCartSnapshot(): CartSnapshot {
  const { items, storageKey } = readStoredCartPayload();
  if (storageKey === 'server' || storageKey === 'storage-error' || storageKey === 'empty') {
    return EMPTY_CART_SNAPSHOT;
  }

  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.productQuantity, 0),
  };
}

export function useCart() {
  const [snapshot, setSnapshot] = useState<CartSnapshot>(() => getCartSnapshot());

  useEffect(() => {
    const sync = () => {
      setSnapshot(getCartSnapshot());
    };

    sync();

    window.addEventListener(CART_CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);

    return () => {
      window.removeEventListener(CART_CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return snapshot;
}

export function addCartItem(input: Omit<CartItem, 'id' | 'createdAt' | 'updatedAt'>) {
  const items = readStoredCartPayload().items;
  const normalizedSelectedOptions = sortSelectedOptions(input.selectedOptions);
  const nextId = buildCartItemId(input.productId, normalizedSelectedOptions);
  const now = new Date().toISOString();
  const existing = items.find((item) => item.id === nextId);

  if (existing) {
    writeStoredCart(
      items.map((item) =>
        item.id === nextId
          ? {
              ...item,
              productQuantity: item.productQuantity + input.productQuantity,
              updatedAt: now,
            }
          : item,
      ),
    );
    return;
  }

  writeStoredCart([
    ...items,
    {
      ...input,
      id: nextId,
      selectedOptions: normalizedSelectedOptions,
      createdAt: now,
      updatedAt: now,
    },
  ]);
}

export function updateCartItemQuantity(itemId: string, productQuantity: number) {
  const items = readStoredCartPayload().items;

  if (productQuantity <= 0) {
    writeStoredCart(items.filter((item) => item.id !== itemId));
    return;
  }

  writeStoredCart(
    items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            productQuantity,
            updatedAt: new Date().toISOString(),
          }
        : item,
    ),
  );
}

export function removeCartItem(itemId: string) {
  writeStoredCart(readStoredCartPayload().items.filter((item) => item.id !== itemId));
}

export function clearCart() {
  clearStoredCart();
  notifyCartChange();
}

export function buildCartOrderQuery(item: CartItem): string {
  const params = new URLSearchParams();

  if (item.selectedOptions.length > 0) {
    params.set(
      'selectedOptions',
      item.selectedOptions
        .map((option) => `${option.groupId}:${option.optionId}:${option.quantity}`)
        .join(';'),
    );
  }

  params.set('quantity', String(item.productQuantity));

  return params.toString();
}

export function calculateCartItemUnitPrice(item: CartItem): number {
  return item.basePrice + item.selectedOptions.reduce((sum, option) => sum + option.extraPrice * option.quantity, 0);
}
