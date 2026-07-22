import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class HomeItemIdParamDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  itemId!: number;
}
