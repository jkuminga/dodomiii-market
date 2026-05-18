import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AdminProductImageDto {
  @IsString()
  @MaxLength(500)
  imageUrl!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
