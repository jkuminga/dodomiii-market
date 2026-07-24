import { Link } from 'react-router-dom';

import { ProductArtwork } from '../../components/store/ProductArtwork';
import { calculateCartItemUnitPrice, clearCart, removeCartItem, updateCartItemQuantity, useCart } from '../../lib/cart';

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function CartPage() {
  const { items, itemCount } = useCart();
  const totalPrice = items.reduce((sum, item) => sum + calculateCartItemUnitPrice(item) * item.productQuantity, 0);
  const onCartItemQuantityChange = (itemId: string, nextValue: number) => {
    const normalizedQuantity = Number.isFinite(nextValue) ? Math.max(1, Math.floor(nextValue)) : 1;
    updateCartItemQuantity(itemId, normalizedQuantity);
  };

  return (
    <main className="m-page cart-page">
      <section className="surface-hero compact-hero">
        <p className="section-kicker">Cart</p>
        <div className="section-title-row">
          <h1 className="section-title">장바구니</h1>
          <span className="metric-chip">{itemCount} items</span>
        </div>
        
      </section>

      {items.length === 0 ? (
        <section className="surface-card status-card">
          <p className="section-kicker">Empty</p>
          <h2 className="section-copy">장바구니가 비어 있습니다</h2>
          <div className="inline-actions">
            <Link className="button" to="/products">
              상품 보러 가기
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="surface-card cart-summary-card">
            <div className="order-summary-row">
              <span>담긴 상품 수</span>
              <strong>{itemCount}개</strong>
            </div>
            <div className="order-summary-row is-total">
              <span>예상 결제 금액</span>
              <strong>{formatCurrency(totalPrice)}</strong>
            </div>
            <div className="inline-actions">
              <button className="button button-ghost" type="button" onClick={() => clearCart()}>
                장바구니 비우기
              </button>
              <Link className="button" to="/cart/order">
                장바구니 주문하기
              </Link>
            </div>
          </section>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(0, 0, 0, 0.06)', margin: '8px 0' }} />

          <section className="cart-item-list" aria-label="장바구니 상품 목록">
            {items.map((item) => {
              const unitPrice = calculateCartItemUnitPrice(item);
              const lineTotalPrice = unitPrice * item.productQuantity;

              return (
                <article className="surface-card cart-item-card" key={item.id}>
                  <div className="cart-item-main">
                    <div className="cart-item-media">
                      <ProductArtwork
                        src={item.thumbnailImageUrl}
                        name={item.productName}
                        category={item.categoryName}
                      />
                    </div>
                    <div className="cart-item-copy">
                      <div className="cart-item-copy-title">
                        <p className="section-kicker">{item.categoryName}</p>
                        <h2 className="section-subtitle">{item.productName}</h2>
                      </div>
                      {item.selectedOptions.length > 0 ? (
                        <ul className="cart-item-option-list">
                          {item.selectedOptions.map((option) => (
                            <li key={`${item.id}-${option.groupId}-${option.optionId}`}>
                              <span>{option.groupName}</span>
                              <strong>
                                {option.optionName}
                                {option.quantity > 1 ? ` x${option.quantity}` : ''}
                              </strong>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="feedback-copy">선택 옵션 없음</p>
                      )}
                    </div>
                  </div>

                  <div className="cart-item-footer">
                    <div className="cart-item-price-block">
                      <div className="cart-item-quantity-control">
                        <span>수량</span>
                        <div className="quantity-stepper" aria-label={`${item.productName} 수량 선택`}>
                          <button
                            className="quantity-button"
                            type="button"
                            onClick={() => onCartItemQuantityChange(item.id, item.productQuantity - 1)}
                            aria-label={`${item.productName} 수량 감소`}
                            disabled={item.productQuantity <= 1}
                          >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="9.5"/>
                              <line x1="7.5" y1="12" x2="16.5" y2="12"/>
                            </svg>
                          </button>
                          <input
                            className="quantity-input"
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            value={item.productQuantity}
                            onChange={(event) => onCartItemQuantityChange(item.id, Number(event.target.value) || 1)}
                          />
                          <button
                            className="quantity-button"
                            type="button"
                            onClick={() => onCartItemQuantityChange(item.id, item.productQuantity + 1)}
                            aria-label={`${item.productName} 수량 증가`}
                          >
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="9.5"/>
                              <line x1="12" y1="7.5" x2="12" y2="16.5"/>
                              <line x1="7.5" y1="12" x2="16.5" y2="12"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      <span>단가 {formatCurrency(unitPrice)}</span>
                      <strong>합계 {formatCurrency(lineTotalPrice)}</strong>
                    </div>

                    <div className="cart-item-actions">
                      <div className="inline-actions cart-item-action-row">
                        <button className="button button-ghost" type="button" onClick={() => removeCartItem(item.id)}>
                          장바구니에서 제거
                        </button>
                        <Link className="button button-secondary" to={`/products/${item.productId}`}>
                          상품 보기
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}
    </main>
  );
}
