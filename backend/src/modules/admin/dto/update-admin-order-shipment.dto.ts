import { ShipmentStatus } from '@prisma/client';
import { IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdminOrderShipmentDto {
  @IsOptional()
  @IsEnum(ShipmentStatus)
  shipmentStatus?: ShipmentStatus;

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
