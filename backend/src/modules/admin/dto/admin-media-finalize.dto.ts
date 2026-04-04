import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AdminMediaFinalizeDto {
  @IsString()
  @MaxLength(500)
  publicId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @MaxLength(1000)
  secureUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  signature?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @IsIn(['image'])
  resourceType?: 'image';

  @IsOptional()
  @IsString()
  @MaxLength(30)
  format?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bytes?: number;
}
