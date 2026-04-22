import { Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export const NOTICE_BLOCK_TYPES = ['text', 'image'] as const;

export class AdminNoticeContentBlockDto {
  @IsIn(NOTICE_BLOCK_TYPES)
  type!: 'text' | 'image';

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string;

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
}

export class AdminNoticeContentDto {
  @IsInt()
  @Min(1)
  version!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminNoticeContentBlockDto)
  blocks!: AdminNoticeContentBlockDto[];
}
