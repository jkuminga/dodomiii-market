import { Link } from 'react-router-dom';

import logoMainImage from '../../assets/images/logo_main3.jpg';
import type { ProductListItem } from '../../lib/api';
import { calculateDiscountedPrice, formatDiscountRate } from '../../lib/productPricing';
import { ProductArtwork } from './ProductArtwork';

type ProductTileProps = {
  product: ProductListItem;
  className?: string;
  showCategory?: boolean;
  style?: React.CSSProperties;
  imageLoading?: 'eager' | 'lazy';
  tabIndex?: number;
  ariaHidden?: boolean;
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

export function ProductTile({ product, className = '', showCategory = false, style, imageLoading = 'lazy', tabIndex, ariaHidden = false }: ProductTileProps) {
  const discountedPrice = calculateDiscountedPrice(product.basePrice, product.discountRate);
  const hasDiscount = product.discountRate > 0 && discountedPrice < product.basePrice;
  const tileClassName = ['product-tile', className].filter(Boolean).join(' ');
  const thumbnailImageUrl = product.thumbnailImageUrl?.trim() || logoMainImage;

  return (
    <Link
      aria-hidden={ariaHidden || undefined}
      className={tileClassName + (product.isSoldOut ? ' is-sold-out' : '')}
      tabIndex={tabIndex}
      to={`/products/${product.id}`}
      style={style}
    >
      <div className="product-media">
        <ProductArtwork src={thumbnailImageUrl} name={product.name} category={product.categoryName} loading={imageLoading} />
        {product.isSoldOut ? (
          <div className="sold-out-overlay">
            <span className="sold-out-badge">SOLD OUT</span>
          </div>
        ) : null}
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
