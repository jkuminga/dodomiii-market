import { IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdminOrderShipmentDto {
  @IsOptional()
  // 배송 단계는 별도 ShipmentStatus가 아니라 주문 상태와 동일한 값으로 처리한다.
  @IsIn(['SHIPPED', 'DELIVERED'])
  orderStatus?: 'SHIPPED' | 'DELIVERED';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  courierName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  trackingNumber?: string | null;

  @IsOptional()
  @IsISO8601()
  shippedAt?: string | null;

  @IsOptional()
  @IsISO8601()
  deliveredAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  changeReason?: string;
}
