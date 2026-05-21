import { Type } from 'class-transformer';
import {
  IsDefined,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { CreateOrderContactDto, CreateRefundPolicyConsentDto } from './create-order.dto';

export class CreateCustomCheckoutOrderDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateOrderContactDto)
  contact!: CreateOrderContactDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => CreateRefundPolicyConsentDto)
  refundPolicyConsent!: CreateRefundPolicyConsentDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerRequest?: string;
}
