import { OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdminOrderStatusDto {
  @IsEnum(OrderStatus)
  orderStatus!: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  changeReason?: string;
}
