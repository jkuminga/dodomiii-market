import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class AdminCategoryIdParamDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  categoryId!: number;
}
