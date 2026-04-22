import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

import { AdminNoticeContentDto } from './admin-notice-content.dto';

export class CreateAdminNoticeDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string | null;

  @ValidateNested()
  @Type(() => AdminNoticeContentDto)
  contentJson!: AdminNoticeContentDto;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;
}
