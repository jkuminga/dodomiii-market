import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const ADMIN_MEDIA_USAGES = ['HOME_POPUP', 'HOME_HERO', 'PRODUCT_THUMBNAIL', 'PRODUCT_DETAIL', 'NOTICE_CONTENT'] as const;

export type AdminMediaUsage = (typeof ADMIN_MEDIA_USAGES)[number];

export class AdminMediaSignUploadDto {
  @IsEnum(ADMIN_MEDIA_USAGES)
  usage!: AdminMediaUsage;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  folderSuffix?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20 * 1024 * 1024)
  size?: number;
}
