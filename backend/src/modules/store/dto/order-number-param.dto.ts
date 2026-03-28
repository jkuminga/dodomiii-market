import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export class OrderNumberParamDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(/^DM\d{8}-\d{4}$/, {
    message: '유효하지 않은 주문번호입니다.',
  })
  orderNumber!: string;
}
