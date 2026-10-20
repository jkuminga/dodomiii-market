import { IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateAdminShippingSettingsDto {
  @IsInt()
  @Min(0)
  baseShippingFee!: number;

  @IsInt()
  @Min(0)
  jejuAdditionalFee!: number;

  @IsInt()
  @Min(0)
  islandAdditionalFee!: number;

  @IsBoolean()
  freeShippingEnabled!: boolean;

  @IsInt()
  @Min(0)
  freeShippingThreshold!: number;
}
