import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class AdminProductIdParamDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  productId!: number;
}
