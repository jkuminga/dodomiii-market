import { Link } from 'react-router-dom';

import { ProductArtwork } from '../../components/store/ProductArtwork';
import { calculateCartItemUnitPrice, clearCart, removeCartItem, useCart } from '../../lib/cart';

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

export function CartPage() {
  const { items, itemCount } = useCart();
  const totalPrice = items.reduce((sum, item) => sum + calculateCartItemUnitPrice(item) * item.productQuantity, 0);

  return (
    <main className="m-page cart-page">
      <section className="surface-hero compact-hero">
        <p className="section-kicker">Cart</p>
        <h1 className="section-title">장바구니</h1>
      </section>

      {items.length === 0 ? (
        <section className="surface-card status-card">
          <p className="section-kicker">Empty</p>
          <h2 className="section-subtitle">장바구니가 비어 있습니다</h2>
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
                전체 비우기
              </button>
              <Link className="button" to="/cart/order">
                장바구니 주문하기
              </Link>
            </div>
          </section>

          <section className="cart-item-list" aria-label="장바구니 상품 목록">
            {items.map((item) => {
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
                    {/* <div className="cart-item-price-block">
                      <span>수량 {item.productQuantity}개</span>
                      <span>단가 {formatCurrency(unitPrice)}</span>
                      <strong>합계 {formatCurrency(lineTotalPrice)}</strong>
                    </div> */}

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
