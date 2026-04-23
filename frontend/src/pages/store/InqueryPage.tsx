import faqImage from '../../assets/images/faq.png';
import inqueryImage from '../../assets/images/inquery.png';

export function InqueryPage() {
  return (
    <main className="m-page inquery-page">
      <section className="surface-card inquery-shell">
        <div className="inquery-hero-copy">
          <p className="section-kicker">Inquery</p>
          <h1 className="section-title inquery-title">문의</h1>
        </div>

        <div className="inquery-faq-visual">
          <img src={faqImage} alt="자주 묻는 질문 안내 이미지" loading="lazy" />
        </div>

        <section className="custom-order-cta-panel inquery-cta-panel" aria-label="문의하기">
          <div className="custom-order-cta-copy">
            <p className="custom-order-cta-kicker">Open Chat</p>
            <h2 className="custom-order-cta-title">추가 문의는 카카오톡 오픈채팅으로 연결됩니다</h2>
            <p className="custom-order-cta-text">버튼을 누르면 오픈채팅으로 이동하며, 주문 문의나 기타 문의를 바로 남길 수 있습니다.</p>
          </div>

          <div className="custom-order-action-row">
            <a
              className="custom-order-kakao-link"
              href="https://open.kakao.com/o/sGNOJYJh"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="카카오톡 오픈채팅 문의하기"
            >
              <img src={inqueryImage} alt="카카오톡 문의하기" loading="lazy" />
            </a>
          </div>
        </section>
      </section>
    </main>
  );
}
