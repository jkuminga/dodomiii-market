import { Type } from 'class-transformer';
import {
  IsDefined,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { CreateOrderContactDto } from './create-order.dto';

export class CreateCustomCheckoutOrderDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateOrderContactDto)
  contact!: CreateOrderContactDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerRequest?: string;
}
