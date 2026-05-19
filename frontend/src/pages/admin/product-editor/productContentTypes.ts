import { ProductContent, ProductContentBlock } from '../../../lib/api';

export type ProductContentTextAlign = 'left' | 'center' | 'right';
export type ProductContentTextSize = 'sm' | 'base' | 'lg' | 'xl';

export type ProductContentBlockDraft =
  | {
      key: string;
      type: 'paragraph';
      text: string;
      textAlign: ProductContentTextAlign;
      textSize: ProductContentTextSize;
    }
  | {
      key: string;
      type: 'quote';
      text: string;
      textAlign: ProductContentTextAlign;
      textSize: ProductContentTextSize;
    }
  | {
      key: string;
      type: 'divider';
    }
  | {
      key: string;
      type: 'image';
      imageUrl: string;
      publicId: string;
      alt: string;
      caption: string;
      linkUrl: string;
      align: 'left' | 'center' | 'right';
      widthMode: 'small' | 'content' | 'wide';
      width: number | null;
      height: number | null;
      isCover: boolean;
      isUploading: boolean;
      uploadError: string;
    };

let productContentSequence = 0;

export function nextProductContentKey(): string {
  productContentSequence += 1;
  return `product-content-${productContentSequence}`;
}

type ProductContentTextStylePatch = {
  textAlign?: ProductContentTextAlign;
  textSize?: ProductContentTextSize;
};

export function createParagraphBlock(text = '', style: ProductContentTextStylePatch = {}): ProductContentBlockDraft {
  return {
    key: nextProductContentKey(),
    type: 'paragraph',
    text,
    textAlign: style.textAlign ?? 'left',
    textSize: style.textSize ?? 'base',
  };
}

export function createQuoteBlock(text = '', style: ProductContentTextStylePatch = {}): ProductContentBlockDraft {
  return {
    key: nextProductContentKey(),
    type: 'quote',
    text,
    textAlign: style.textAlign ?? 'left',
    textSize: style.textSize ?? 'base',
  };
}

export function createDividerBlock(): ProductContentBlockDraft {
  return {
    key: nextProductContentKey(),
    type: 'divider',
  };
}

export function createImageBlock(patch: Partial<Extract<ProductContentBlockDraft, { type: 'image' }>> = {}): ProductContentBlockDraft {
  return {
    key: nextProductContentKey(),
    type: 'image',
    imageUrl: '',
    publicId: '',
    alt: '',
    caption: '',
    linkUrl: '',
    align: 'center',
    widthMode: 'content',
    width: null,
    height: null,
    isCover: false,
    isUploading: false,
    uploadError: '',
    ...patch,
  };
}

export function productContentBlocksFromContent(content: ProductContent | null | undefined): ProductContentBlockDraft[] {
  if (!content?.blocks.length) {
    return [createParagraphBlock()];
  }

  return content.blocks.map((block) => {
    if (block.type === 'paragraph') {
      return {
        ...createParagraphBlock(block.text),
        textAlign: block.textAlign ?? 'left',
        textSize: block.textSize ?? 'base',
      };
    }

    if (block.type === 'quote') {
      return {
        ...createQuoteBlock(block.text),
        textAlign: block.textAlign ?? 'left',
        textSize: block.textSize ?? 'base',
      };
    }

    if (block.type === 'divider') {
      return createDividerBlock();
    }

    return createImageBlock({
      imageUrl: block.imageUrl,
      publicId: block.publicId ?? '',
      alt: block.alt ?? '',
      caption: block.caption ?? '',
      linkUrl: block.linkUrl ?? '',
      align: block.align,
      widthMode: block.widthMode,
      width: block.width ?? null,
      height: block.height ?? null,
      isCover: block.isCover ?? false,
    });
  });
}

export function productContentToDrafts(description: string | null | undefined): ProductContentBlockDraft[] {
  return [createParagraphBlock(description?.trim() ?? '')];
}

export function buildProductContent(blocks: ProductContentBlockDraft[]): ProductContent | null {
  const normalizedBlocks = blocks.reduce<ProductContentBlock[]>((accumulator, block) => {
    if (block.type === 'paragraph' || block.type === 'quote') {
      const text = block.text.trim();

      if (text) {
        accumulator.push({
          type: block.type,
          text,
          textAlign: block.textAlign,
          textSize: block.textSize,
        });
      }

      return accumulator;
    }

    if (block.type === 'divider') {
      accumulator.push({ type: 'divider' });
      return accumulator;
    }

    if (block.imageUrl.trim() && !block.isUploading) {
      accumulator.push({
        type: 'image',
        imageUrl: block.imageUrl.trim(),
        publicId: block.publicId.trim() || null,
        alt: block.alt.trim() || null,
        caption: block.caption.trim() || null,
        linkUrl: block.linkUrl.trim() || null,
        align: block.align,
        widthMode: block.widthMode,
        width: block.width,
        height: block.height,
        isCover: block.isCover,
      });
    }

    return accumulator;
  }, []);

  return normalizedBlocks.length > 0
    ? {
        version: 1,
        blocks: normalizedBlocks,
      }
    : null;
}

export function productContentPlainText(blocks: ProductContentBlockDraft[]): string {
  return blocks
    .filter((block): block is Extract<ProductContentBlockDraft, { type: 'paragraph' | 'quote' }> => block.type === 'paragraph' || block.type === 'quote')
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 5000);
}
