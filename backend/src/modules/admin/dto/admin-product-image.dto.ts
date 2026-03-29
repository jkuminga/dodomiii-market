import { ProductImageType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AdminProductImageDto {
  @IsEnum(ProductImageType)
  imageType!: ProductImageType;

  @IsString()
  @MaxLength(500)
  imageUrl!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
