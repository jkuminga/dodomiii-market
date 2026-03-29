import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class AdminOrderIdParamDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  orderId!: number;
}
