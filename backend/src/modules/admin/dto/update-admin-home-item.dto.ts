import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { HomeItemSection } from '@prisma/client';

export class UpdateAdminHomeItemDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemId?: number;

  @IsEnum(HomeItemSection)
  section!: HomeItemSection;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
