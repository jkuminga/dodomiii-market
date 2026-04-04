import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateAdminHomePopupDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  popupId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string | null;

  @IsString()
  @MaxLength(500)
  imageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
