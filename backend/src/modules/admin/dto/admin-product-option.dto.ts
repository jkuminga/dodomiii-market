import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AdminProductOptionDto {
  @IsString()
  @MaxLength(100)
  optionGroupName!: string;

  @IsString()
  @MaxLength(100)
  optionValue!: string;

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
