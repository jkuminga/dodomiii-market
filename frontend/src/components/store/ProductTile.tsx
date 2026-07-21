import { Link } from 'react-router-dom';

import type { ProductListItem } from '../../lib/api';
import { calculateDiscountedPrice, formatDiscountRate } from '../../lib/productPricing';
import { ProductArtwork } from './ProductArtwork';

type ProductTileProps = {
  product: ProductListItem;
  className?: string;
  showCategory?: boolean;
};

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ko-KR')}원`;
}

function getProductCategoryLabel(product: ProductListItem): string {
  if (product.categories.length > 0) {
    return product.categories.map((category) => category.name).join(' / ');
  }

  return product.categoryName;
}

export function ProductTile({ product, className = '', showCategory = false }: ProductTileProps) {
  const discountedPrice = calculateDiscountedPrice(product.basePrice, product.discountRate);
  const hasDiscount = product.discountRate > 0 && discountedPrice < product.basePrice;
  const tileClassName = ['product-tile', className].filter(Boolean).join(' ');

  return (
    <Link className={tileClassName} to={`/products/${product.id}`}>
      <div className="product-media">
        <ProductArtwork src={product.thumbnailImageUrl} name={product.name} category={product.categoryName} />
        {product.isSoldOut ? <span className="status-pill is-muted">품절</span> : null}
      </div>

      <div className="product-body">
        {showCategory ? <p className="section-kicker-category">{getProductCategoryLabel(product)}</p> : null}
        <h2 className="product-name">{product.name}</h2>
        <p className="product-description">{product.shortDescription ?? '상품 설명이 준비 중입니다.'}</p>

        <div className="product-meta-row">
          <div className="product-price-stack">
            {hasDiscount ? (
              <>
                <strong className="price-text">{formatCurrency(discountedPrice)}</strong>
                <span className="product-original-price">{formatCurrency(product.basePrice)}</span>
              </>
            ) : (
              <strong className="price-text">{formatCurrency(product.basePrice)}</strong>
            )}
          </div>
          {hasDiscount ? <span className="product-discount-rate">{formatDiscountRate(product.discountRate)}</span> : null}
        </div>
      </div>
    </Link>
  );
}
