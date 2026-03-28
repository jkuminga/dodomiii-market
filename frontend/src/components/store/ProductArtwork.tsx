import { useState } from 'react';

type ProductArtworkProps = {
  src?: string | null;
  name: string;
  category?: string;
  className?: string;
};

function getInitials(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return 'DM';
  }

  return tokens
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() ?? '')
    .join('');
}

export function ProductArtwork({ src, name, category, className = '' }: ProductArtworkProps) {
  const [hasError, setHasError] = useState(false);

  if (src && !hasError) {
    return (
      <img
        className={`product-artwork-image ${className}`.trim()}
        src={src}
        alt={name}
        loading="lazy"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div className={`product-artwork-fallback ${className}`.trim()} role="img" aria-label={name}>
      <span className="product-artwork-orb product-artwork-orb-a" aria-hidden="true" />
      <span className="product-artwork-orb product-artwork-orb-b" aria-hidden="true" />
      <span className="product-artwork-orb product-artwork-orb-c" aria-hidden="true" />
      <div className="product-artwork-copy">
        <strong>{getInitials(name)}</strong>
        <span>{category ?? 'HANDMADE OBJECT'}</span>
      </div>
    </div>
  );
}
