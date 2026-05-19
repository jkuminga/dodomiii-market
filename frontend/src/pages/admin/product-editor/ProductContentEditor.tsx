import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';

import {
  createDividerBlock,
  createImageBlock,
  createParagraphBlock,
  createQuoteBlock,
  ProductContentBlockDraft,
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

  const removeBlock = (key: string) => {
    const removedBlock = blocksRef.current.find((block) => block.key === key);
    const next = blocksRef.current.filter((block) => block.key !== key);
    const nextBlocks = next.length > 0 ? next : [createParagraphBlock()];
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
    >
      <div className="product-content-toolbar" aria-label="본문 블록 추가">
        <button className="button button-secondary" type="button" onClick={() => appendBlock(createParagraphBlock())}>
          텍스트
        </button>
        <button className="button button-secondary" type="button" onClick={() => appendBlock(createImageBlock())}>
          이미지
        </button>
        <button className="button button-secondary" type="button" onClick={() => appendBlock(createQuoteBlock())}>
          인용구
        </button>
        <button className="button button-secondary" type="button" onClick={() => appendBlock(createDividerBlock())}>
          구분선
        </button>
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
          <button className="product-content-inline-add" type="button" onClick={() => appendBlock(createParagraphBlock())}>
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
        <button className="product-content-handle" type="button" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} aria-label="블록 이동">
          ::
        </button>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0}>
          위
        </button>
        <button type="button" onClick={() => onMove(1)}>
          아래
        </button>
        <button type="button" onClick={onRemove}>
          삭제
        </button>
      </div>

      {block.type === 'paragraph' ? (
        <textarea
          className="product-content-textarea"
          value={block.text}
          onChange={(event) => onChange({ text: event.target.value } as Partial<ProductContentBlockDraft>)}
          placeholder="상품 설명을 입력하세요"
          rows={Math.max(3, block.text.split('\n').length + 1)}
        />
      ) : null}

      {block.type === 'quote' ? (
        <textarea
          className="product-content-textarea is-quote"
          value={block.text}
          onChange={(event) => onChange({ text: event.target.value } as Partial<ProductContentBlockDraft>)}
          placeholder="강조하고 싶은 문장을 입력하세요"
          rows={Math.max(2, block.text.split('\n').length + 1)}
        />
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
