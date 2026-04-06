import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateAdminCategoryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  parentId?: number | null;

  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(100)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isOnLandingPage?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;
}
