import { ChangeEvent, ClipboardEvent, DragEvent, useEffect, useRef, useState } from 'react';

import {
  createDividerBlock,
  createImageBlock,
  createParagraphBlock,
  createQuoteBlock,
  ProductContentBlockDraft,
  ProductContentTextAlign,
  ProductContentTextSize,
} from './productContentTypes';

type UploadedProductImage = {
  imageUrl: string;
  publicId: string;
  width: number | null;
  height: number | null;
};

type ProductContentEditorProps = {
  blocks: ProductContentBlockDraft[];
  onChange: (blocks: ProductContentBlockDraft[]) => void;
  onUploadImage: (file: File) => Promise<UploadedProductImage>;
  onDeleteImage: (publicId: string) => void;
  formatFileSize: (bytes: number) => string;
};

export function ProductContentEditor({ blocks, onChange, onUploadImage, onDeleteImage, formatFileSize }: ProductContentEditorProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [openImageSettingsKey, setOpenImageSettingsKey] = useState<string | null>(null);
  const [defaultTextAlign, setDefaultTextAlign] = useState<ProductContentTextAlign>('left');
  const [defaultTextSize, setDefaultTextSize] = useState<ProductContentTextSize>('base');
  const blocksRef = useRef(blocks);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const updateBlock = (key: string, patch: Partial<ProductContentBlockDraft>) => {
    const nextBlocks = blocksRef.current.map((block) => (block.key === key ? ({ ...block, ...patch } as ProductContentBlockDraft) : block));
    blocksRef.current = nextBlocks;
    onChange(nextBlocks);
  };

  const insertBlock = (index: number, block: ProductContentBlockDraft) => {
    const next = [...blocksRef.current];
    next.splice(index, 0, block);
    blocksRef.current = next;
    onChange(next);
    setActiveKey(block.key);
  };

  const appendBlock = (block: ProductContentBlockDraft) => insertBlock(blocksRef.current.length, block);

  const createDefaultParagraphBlock = (text = '') => createParagraphBlock(text, { textAlign: defaultTextAlign, textSize: defaultTextSize });
  const createDefaultQuoteBlock = (text = '') => createQuoteBlock(text, { textAlign: defaultTextAlign, textSize: defaultTextSize });

  const removeBlock = (key: string) => {
    const removedBlock = blocksRef.current.find((block) => block.key === key);
    const next = blocksRef.current.filter((block) => block.key !== key);
    const nextBlocks = next.length > 0 ? next : [createDefaultParagraphBlock()];
    blocksRef.current = nextBlocks;
    onChange(nextBlocks);
    setActiveKey((current) => (current === key ? null : current));
    setOpenImageSettingsKey((current) => (current === key ? null : current));

    if (removedBlock?.type === 'image' && removedBlock.publicId.trim()) {
      onDeleteImage(removedBlock.publicId.trim());
    }
  };

  const moveBlock = (key: string, direction: -1 | 1) => {
    const index = blocksRef.current.findIndex((block) => block.key === key);
    const nextIndex = index + direction;

    if (index < 0 || nextIndex < 0 || nextIndex >= blocksRef.current.length) {
      return;
    }

    const next = [...blocksRef.current];
    const [target] = next.splice(index, 1);
    next.splice(nextIndex, 0, target);
    blocksRef.current = next;
    onChange(next);
  };

  const uploadIntoBlock = async (key: string, file: File) => {
    const previousBlock = blocksRef.current.find((block) => block.key === key);
    const previousPublicId = previousBlock?.type === 'image' ? previousBlock.publicId.trim() : '';

    updateBlock(key, { isUploading: true, uploadError: '' } as Partial<ProductContentBlockDraft>);

    try {
      const uploaded = await onUploadImage(file);
      updateBlock(key, {
        imageUrl: uploaded.imageUrl,
        publicId: uploaded.publicId,
        width: uploaded.width,
        height: uploaded.height,
        isUploading: false,
        uploadError: '',
      } as Partial<ProductContentBlockDraft>);

      if (previousPublicId && previousPublicId !== uploaded.publicId) {
        onDeleteImage(previousPublicId);
      }
    } catch (caught) {
      updateBlock(key, {
        isUploading: false,
        uploadError: caught instanceof Error ? caught.message : '이미지 업로드에 실패했습니다.',
      } as Partial<ProductContentBlockDraft>);
    }
  };

  const insertFiles = (files: FileList | File[], index: number) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      return;
    }

    const nextBlocks = imageFiles.map((file) =>
      createImageBlock({
        isUploading: true,
      }),
    );
    const next = [...blocksRef.current];
    next.splice(index, 0, ...nextBlocks);
    blocksRef.current = next;
    onChange(next);

    nextBlocks.forEach((block, fileIndex) => {
      void uploadIntoBlock(block.key, imageFiles[fileIndex]);
    });
  };

  const onCanvasPaste = (event: ClipboardEvent<HTMLElement>) => {
    const imageFiles = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      return;
    }

    event.preventDefault();
    const activeIndex = activeKey ? blocksRef.current.findIndex((block) => block.key === activeKey) : -1;
    insertFiles(imageFiles, activeIndex >= 0 ? activeIndex + 1 : blocksRef.current.length);
  };

  const onCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDropIndex(null);

    if (event.dataTransfer.files.length > 0) {
      insertFiles(event.dataTransfer.files, dropIndex ?? blocks.length);
      return;
    }

    const sourceKey = draggingKey ?? event.dataTransfer.getData('text/plain');
    if (!sourceKey || dropIndex === null) {
      return;
    }

    const sourceIndex = blocksRef.current.findIndex((block) => block.key === sourceKey);
    if (sourceIndex < 0) {
      return;
    }

    const next = [...blocksRef.current];
    const [target] = next.splice(sourceIndex, 1);
    const adjustedIndex = sourceIndex < dropIndex ? dropIndex - 1 : dropIndex;
    next.splice(adjustedIndex, 0, target);
    blocksRef.current = next;
    onChange(next);
    setDraggingKey(null);
  };

  return (
    <section
      className="product-content-editor"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = event.dataTransfer.files.length > 0 ? 'copy' : 'move';
      }}
      onDrop={onCanvasDrop}
      onPaste={onCanvasPaste}
      tabIndex={0}
    >
      <div className="product-content-toolbar" aria-label="본문 블록 추가">
        <button className="product-content-toolbar-button" type="button" onClick={() => appendBlock(createDefaultParagraphBlock())} aria-label="텍스트 블록 추가" data-tooltip="텍스트">
          <TextBlockIcon />
        </button>
        <button className="product-content-toolbar-button" type="button" onClick={() => appendBlock(createImageBlock())} aria-label="이미지 블록 추가" data-tooltip="이미지">
          <ImageBlockIcon />
        </button>
        <button className="product-content-toolbar-button" type="button" onClick={() => appendBlock(createDefaultQuoteBlock())} aria-label="인용구 블록 추가" data-tooltip="인용구">
          <QuoteBlockIcon />
        </button>
        <button className="product-content-toolbar-button" type="button" onClick={() => appendBlock(createDividerBlock())} aria-label="구분선 블록 추가" data-tooltip="구분선">
          <DividerBlockIcon />
        </button>
        <div className="product-content-default-text-controls" aria-label="새 텍스트 블록 기본값">
          <span className="product-content-default-text-label">새 텍스트 기본값 ㅣ </span>
          <label>
            <span>크기</span>
            <select value={defaultTextSize} onChange={(event) => setDefaultTextSize(event.target.value as ProductContentTextSize)}>
              <option value="sm">작게</option>
              <option value="base">기본</option>
              <option value="lg">크게</option>
              <option value="xl">아주 크게</option>
            </select>
          </label>
          <label>
            <span>정렬</span>
            <select value={defaultTextAlign} onChange={(event) => setDefaultTextAlign(event.target.value as ProductContentTextAlign)}>
              <option value="left">왼쪽</option>
              <option value="center">가운데</option>
              <option value="right">오른쪽</option>
            </select>
          </label>
        </div>
      </div>

      <div className="product-content-canvas">
        {blocks.map((block, index) => (
          <div
            className={`product-content-drop-row ${dropIndex === index ? 'is-target' : ''}`}
            key={`drop-${block.key}`}
            onDragEnter={() => setDropIndex(index)}
          >
            <ProductContentBlockEditor
              active={activeKey === block.key}
              block={block}
              formatFileSize={formatFileSize}
              index={index}
              onActivate={() => setActiveKey(block.key)}
              onChange={(patch) => updateBlock(block.key, patch)}
              imageSettingsOpen={openImageSettingsKey === block.key}
              onMove={(direction) => moveBlock(block.key, direction)}
              onRemove={() => removeBlock(block.key)}
              onSelectFiles={(files) => insertFiles(files, index + 1)}
              onToggleImageSettings={() => setOpenImageSettingsKey((current) => (current === block.key ? null : block.key))}
              onUploadFile={(file) => uploadIntoBlock(block.key, file)}
              onDragStart={(event) => {
                setDraggingKey(block.key);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', block.key);
              }}
              onDragEnd={() => {
                setDraggingKey(null);
                setDropIndex(null);
              }}
            />
          </div>
        ))}

        <div className={`product-content-final-drop ${dropIndex === blocks.length ? 'is-target' : ''}`} onDragEnter={() => setDropIndex(blocks.length)}>
          <button className="product-content-inline-add" type="button" onClick={() => appendBlock(createDefaultParagraphBlock())}>
            + 계속 작성
          </button>
        </div>
      </div>
    </section>
  );
}

type ProductContentBlockEditorProps = {
  active: boolean;
  block: ProductContentBlockDraft;
  formatFileSize: (bytes: number) => string;
  index: number;
  onActivate: () => void;
  onChange: (patch: Partial<ProductContentBlockDraft>) => void;
  imageSettingsOpen: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onSelectFiles: (files: FileList) => void;
  onToggleImageSettings: () => void;
  onUploadFile: (file: File) => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
};

function ProductContentBlockEditor({
  active,
  block,
  formatFileSize,
  index,
  onActivate,
  onChange,
  imageSettingsOpen,
  onMove,
  onRemove,
  onSelectFiles,
  onToggleImageSettings,
  onUploadFile,
  onDragStart,
  onDragEnd,
}: ProductContentBlockEditorProps) {
  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (file) {
      onUploadFile(file);
    }
  };

  return (
    <article className={`product-content-block is-${block.type} ${active ? 'is-active' : ''}`} onFocus={onActivate} onClick={onActivate}>
      <div className="product-content-block-tools">
        <button className="product-content-handle" type="button" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} aria-label="블록 이동" title="블록 이동">
          <GripIcon />
        </button>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="위로 이동" title="위로 이동">
          <ChevronUpIcon />
        </button>
        <button type="button" onClick={() => onMove(1)} aria-label="아래로 이동" title="아래로 이동">
          <ChevronDownIcon />
        </button>
        <button type="button" onClick={onRemove} aria-label="블록 삭제" title="블록 삭제">
          <TrashIcon />
        </button>
      </div>

      {block.type === 'paragraph' ? (
        <div className="product-content-text-block-editor">
          <textarea
            className={`product-content-textarea align-${block.textAlign} size-${block.textSize}`}
            value={block.text}
            onChange={(event) => onChange({ text: event.target.value } as Partial<ProductContentBlockDraft>)}
            placeholder="상품 설명을 입력하세요"
            rows={Math.max(3, block.text.split('\n').length + 1)}
          />
          <TextBlockStyleControls block={block} onChange={onChange} />
        </div>
      ) : null}

      {block.type === 'quote' ? (
        <div className="product-content-text-block-editor">
          <textarea
            className={`product-content-textarea is-quote align-${block.textAlign} size-${block.textSize}`}
            value={block.text}
            onChange={(event) => onChange({ text: event.target.value } as Partial<ProductContentBlockDraft>)}
            placeholder="강조하고 싶은 문장을 입력하세요"
            rows={Math.max(2, block.text.split('\n').length + 1)}
          />
          <TextBlockStyleControls block={block} onChange={onChange} />
        </div>
      ) : null}

      {block.type === 'divider' ? <hr className="product-content-editor-divider" /> : null}

      {block.type === 'image' ? (
        <div className="product-content-image-editor">
          {block.imageUrl ? (
            <div className={`product-content-image-frame align-${block.align} width-${block.widthMode}`}>
              <img src={block.imageUrl} alt={block.alt || block.caption || ''} />
              <button
                className="product-content-image-settings-button"
                type="button"
                aria-expanded={imageSettingsOpen}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleImageSettings();
                }}
              >
                설정
              </button>
              {imageSettingsOpen ? (
                <div className="product-content-image-settings-popover" onClick={(event) => event.stopPropagation()}>
                  <div className="product-content-image-settings-head">
                    <strong>이미지 설정</strong>
                    {block.width && block.height ? <span>{`${block.width}x${block.height}`}</span> : null}
                  </div>
                  <label className="button button-ghost product-content-image-replace">
                    이미지 교체
                    <input className="sr-only" type="file" accept="image/*" onChange={onFileChange} />
                  </label>
                  <label className="field">
                    <span>크기</span>
                    <select
                      value={block.widthMode}
                      onChange={(event) => onChange({ widthMode: event.target.value as 'small' | 'content' | 'wide' } as Partial<ProductContentBlockDraft>)}
                    >
                      <option value="small">작게</option>
                      <option value="content">본문 너비</option>
                      <option value="wide">넓게</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>정렬</span>
                    <select
                      value={block.align}
                      onChange={(event) => onChange({ align: event.target.value as 'left' | 'center' | 'right' } as Partial<ProductContentBlockDraft>)}
                    >
                      <option value="left">왼쪽</option>
                      <option value="center">가운데</option>
                      <option value="right">오른쪽</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>대체 텍스트</span>
                    <input value={block.alt} onChange={(event) => onChange({ alt: event.target.value } as Partial<ProductContentBlockDraft>)} />
                  </label>
                  <label className="field">
                    <span>링크</span>
                    <input
                      value={block.linkUrl}
                      onChange={(event) => onChange({ linkUrl: event.target.value } as Partial<ProductContentBlockDraft>)}
                      placeholder="https://..."
                    />
                  </label>
                </div>
              ) : null}
            </div>
          ) : (
            <label
              className="product-content-image-drop"
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (event.dataTransfer.files.length > 0) {
                  onSelectFiles(event.dataTransfer.files);
                }
              }}
            >
              <input className="sr-only" type="file" accept="image/*" onChange={onFileChange} />
              <span>{block.isUploading ? '이미지 업로드 중...' : '이미지를 드래그하거나 클릭해서 넣기'}</span>
            </label>
          )}

          {block.uploadError ? <p className="feedback-copy is-error">{block.uploadError}</p> : null}

          <input
            className="product-content-caption-input"
            value={block.caption}
            onChange={(event) => onChange({ caption: event.target.value } as Partial<ProductContentBlockDraft>)}
            placeholder="이미지 설명 입력"
          />
          {block.isUploading ? <p className="admin-inline-note">업로드 중인 파일은 저장 전에 완료되어야 합니다.</p> : null}
        </div>
      ) : null}
    </article>
  );
}

type TextBlockStyleControlsProps = {
  block: Extract<ProductContentBlockDraft, { type: 'paragraph' | 'quote' }>;
  onChange: (patch: Partial<ProductContentBlockDraft>) => void;
};

function TextBlockStyleControls({ block, onChange }: TextBlockStyleControlsProps) {
  return (
    <div className="product-content-text-style-controls" aria-label="텍스트 스타일 설정">
      <div className="product-content-text-style-menu">
        <button className="product-content-text-style-trigger" type="button" aria-label="텍스트 크기 설정">
          <TextSizeIcon />
        </button>
        <div className="product-content-text-style-popover" role="menu" aria-label="텍스트 크기 옵션">
          {[
            { value: 'sm', label: '작게' },
            { value: 'base', label: '기본' },
            { value: 'lg', label: '크게' },
            { value: 'xl', label: '아주 크게' },
          ].map((option) => (
            <button
              className={block.textSize === option.value ? 'is-active' : ''}
              key={option.value}
              type="button"
              role="menuitem"
              onClick={() => onChange({ textSize: option.value as ProductContentTextSize } as Partial<ProductContentBlockDraft>)}
            >
              <span className={`text-size-preview size-${option.value}`}>A</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="product-content-text-style-menu">
        <button className="product-content-text-style-trigger" type="button" aria-label="텍스트 정렬 설정">
          <TextAlignIcon />
        </button>
        <div className="product-content-text-style-popover" role="menu" aria-label="텍스트 정렬 옵션">
          {[
            { value: 'left', label: '왼쪽', Icon: AlignLeftIcon },
            { value: 'center', label: '가운데', Icon: AlignCenterIcon },
            { value: 'right', label: '오른쪽', Icon: AlignRightIcon },
          ].map((option) => {
            const Icon = option.Icon;
            return (
              <button
                className={block.textAlign === option.value ? 'is-active' : ''}
                key={option.value}
                type="button"
                role="menuitem"
                onClick={() => onChange({ textAlign: option.value as ProductContentTextAlign } as Partial<ProductContentBlockDraft>)}
              >
                <Icon />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GripIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <circle cx="7" cy="5" r="1.3" />
      <circle cx="13" cy="5" r="1.3" />
      <circle cx="7" cy="10" r="1.3" />
      <circle cx="13" cy="10" r="1.3" />
      <circle cx="7" cy="15" r="1.3" />
      <circle cx="13" cy="15" r="1.3" />
    </svg>
  );
}

function TextBlockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M5 5h10" />
      <path d="M10 5v10" />
      <path d="M7.8 15h4.4" />
    </svg>
  );
}

function ImageBlockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <rect x="4" y="5" width="12" height="10" rx="1.8" />
      <circle cx="8" cy="8.3" r="1.1" />
      <path d="m5.8 13.6 3.5-3.4 2.2 2.1 1.2-1.1 1.8 2.4" />
    </svg>
  );
}

function QuoteBlockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M7.7 8.2H5.4c-.2 0-.4.1-.4.4v2.8c0 .2.2.4.4.4h2.3c.2 0 .4-.2.4-.4V8.6c0-1.4-.6-2.4-1.9-3.1" />
      <path d="M15 8.2h-2.3c-.2 0-.4.1-.4.4v2.8c0 .2.2.4.4.4H15c.2 0 .4-.2.4-.4V8.6c0-1.4-.6-2.4-1.9-3.1" />
    </svg>
  );
}

function DividerBlockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M4 10h12" />
      <path d="M6 6h8" />
      <path d="M6 14h8" />
    </svg>
  );
}

function TextSizeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M4.5 15 8.8 5h2.4l4.3 10" />
      <path d="M6.3 11.2h7.4" />
      <path d="M3.8 5h4" />
      <path d="M5.8 5v10" />
    </svg>
  );
}

function TextAlignIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M4 5h12" />
      <path d="M4 9h9" />
      <path d="M4 13h12" />
      <path d="M4 17h7" />
    </svg>
  );
}

function AlignLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M4 5h12" />
      <path d="M4 9h8" />
      <path d="M4 13h12" />
      <path d="M4 17h7" />
    </svg>
  );
}

function AlignCenterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M4 5h12" />
      <path d="M6 9h8" />
      <path d="M4 13h12" />
      <path d="M6.5 17h7" />
    </svg>
  );
}

function AlignRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M4 5h12" />
      <path d="M8 9h8" />
      <path d="M4 13h12" />
      <path d="M9 17h7" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M5.5 12.5 10 8l4.5 4.5" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M5.5 7.5 10 12l4.5-4.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M7 6.5V5.3c0-.7.6-1.3 1.3-1.3h3.4c.7 0 1.3.6 1.3 1.3v1.2" />
      <path d="M4.8 6.5h10.4" />
      <path d="m6.1 8 .5 7.1c.1.8.7 1.4 1.5 1.4h3.8c.8 0 1.5-.6 1.5-1.4L13.9 8" />
      <path d="M8.7 9.6v4.7" />
      <path d="M11.3 9.6v4.7" />
    </svg>
  );
}
