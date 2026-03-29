import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAdminCustomOrderLinkDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  finalTotalPrice!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  shippingFee!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsDateString()
  expiresAt!: string;
}
