import { Link } from 'react-router-dom';

import inqueryImage from '../../assets/images/inquery.png';
import logoMainImage from '../../assets/images/logo_main3.jpg';
import { ProductArtwork } from '../../components/store/ProductArtwork';

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function CustomOrderProductPage() {
  return (
    <main className="m-page custom-order-page">
      <section className="surface-card custom-order-shell">
        <div className="custom-order-media">
          <Link className="m-icon-btn custom-order-media-back" to="/products" aria-label="상품 목록으로 이동">
            <ArrowLeftIcon />
          </Link>
          <ProductArtwork src={logoMainImage} name="커스텀 주문용 상품" category="꽃다발" />
        </div>

        <div className="custom-order-content">
          <div className="custom-order-detail-body">
            <div className="custom-order-detail-copy">
              <p className="section-kicker">꽃다발</p>
              <h1 className="section-title custom-order-title">커스텀 주문용 상품</h1>
              <p className="section-copy custom-order-summary">
                원하시는 색감, 예산, 수령 일정에 맞춰 상담 후 제작해드리는 주문 전용 상품입니다.
              </p>
              <p className="custom-order-detail-note">
                요청 내용을 카카오톡으로 남겨주시면 확인 후 제작 가능 여부와 진행 방법을 안내드립니다.
              </p>
            </div>

            <aside className="custom-order-cta-panel" aria-label="커스텀 주문 문의 액션">
              <div className="custom-order-cta-copy">
                <p className="custom-order-cta-kicker">빠른 상담</p>
                <h2 className="custom-order-cta-title">카카오톡으로 맞춤 제작 상담을 시작하세요</h2>
                <p className="custom-order-cta-text">오픈채팅으로 문의를 남겨주시면 확인 후 제작 가능 여부와 진행 방법을 안내드립니다.</p>
              </div>
              <p className="custom-order-cta-helper">원하는 색감, 예산, 수령 일정을 함께 남겨주시면 상담이 더 빠르게 이어집니다.</p>

              <div className="custom-order-action-row">
                <a
                  className="custom-order-kakao-link"
                  href="https://open.kakao.com/o/sGNOJYJh"
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="카카오톡 문의하기 열기"
                >
                  <img src={inqueryImage} alt="카카오톡 문의하기" loading="lazy" />
                </a>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
}
