import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';

export const PRODUCT_CONTENT_BLOCK_TYPES = ['paragraph', 'image', 'divider', 'quote', 'spacer'] as const;

export class AdminProductContentBlockDto {
  @IsIn(PRODUCT_CONTENT_BLOCK_TYPES)
  type!: 'paragraph' | 'image' | 'divider' | 'quote' | 'spacer';

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string;

  @IsOptional()
  @IsIn(['left', 'center', 'right'])
  textAlign?: 'left' | 'center' | 'right';

  @IsOptional()
  @IsIn(['sm', 'base', 'lg', 'xl'])
  textSize?: 'sm' | 'base' | 'lg' | 'xl';

  @IsOptional()
  @IsIn(['normal', 'bold'])
  fontWeight?: 'normal' | 'bold';

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  textColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  publicId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  alt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  caption?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string | null;

  @IsOptional()
  @IsIn(['left', 'center', 'right'])
  align?: 'left' | 'center' | 'right';

  @IsOptional()
  @IsIn(['small', 'content', 'wide'])
  widthMode?: 'small' | 'content' | 'wide';

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number | null;

  @IsOptional()
  @IsBoolean()
  isCover?: boolean;
}

export class AdminProductContentDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminProductContentBlockDto)
  blocks!: AdminProductContentBlockDto[];
}
