import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  ArrayNotEmpty,
  ArrayUnique,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { AdminProductImageDto } from './admin-product-image.dto';
import { AdminProductOptionGroupDto } from './admin-product-option.dto';
import { AdminProductContentDto } from './admin-product-content.dto';

export class CreateAdminProductDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  categoryIds!: number[];

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(200)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  shortDescription?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminProductContentDto)
  contentJson?: AdminProductContentDto | null;

  @IsInt()
  @Min(0)
  basePrice!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountRate?: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsBoolean()
  isSoldOut?: boolean;

  @IsOptional()
  @IsBoolean()
  consultationRequired?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminProductImageDto)
  images?: AdminProductImageDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminProductOptionGroupDto)
  optionGroups?: AdminProductOptionGroupDto[];
}
