import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductOptionSelectionType } from '@prisma/client';

export class AdminProductOptionItemDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxQuantity?: number | null;

  @IsOptional()
  @IsInt()
  extraPrice?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class AdminProductOptionGroupDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsEnum(ProductOptionSelectionType)
  selectionType!: ProductOptionSelectionType;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminProductOptionItemDto)
  options!: AdminProductOptionItemDto[];
}
