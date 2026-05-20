import { ProductContent } from '../../lib/api';

type ProductContentRendererProps = {
  content: ProductContent;
};

export function ProductContentRenderer({ content }: ProductContentRendererProps) {
  return (
    <div className="product-content-renderer">
      {content.blocks.map((block, index) => {
        if (block.type === 'paragraph') {
          return (
            <p
              className={`product-content-paragraph align-${block.textAlign ?? 'left'} size-${block.textSize ?? 'base'} weight-${block.fontWeight ?? 'normal'}`}
              key={`${block.type}-${index}`}
              style={{ color: block.textColor ?? undefined }}
            >
              {block.text}
            </p>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              className={`product-content-quote align-${block.textAlign ?? 'left'} size-${block.textSize ?? 'base'} weight-${block.fontWeight ?? 'normal'}`}
              key={`${block.type}-${index}`}
              style={{ color: block.textColor ?? undefined }}
            >
              {block.text}
            </blockquote>
          );
        }

        if (block.type === 'divider') {
          return <hr className="product-content-divider" key={`${block.type}-${index}`} />;
        }

        if (block.type === 'spacer') {
          return <div className="product-content-spacer" aria-hidden="true" key={`${block.type}-${index}`} />;
        }

        const image = <img src={block.imageUrl} alt={block.alt ?? block.caption ?? ''} loading="lazy" />;

        return (
          <figure
            className={`product-content-image align-${block.align} width-${block.widthMode}`}
            key={`${block.type}-${block.imageUrl}-${index}`}
          >
            {block.linkUrl ? (
              <a href={block.linkUrl} target="_blank" rel="noreferrer">
                {image}
              </a>
            ) : (
              image
            )}
            {block.caption ? <figcaption>{block.caption}</figcaption> : null}
          </figure>
        );
      })}
    </div>
  );
}
