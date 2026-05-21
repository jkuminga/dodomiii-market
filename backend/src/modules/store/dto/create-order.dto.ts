import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemOptionSelectionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productOptionGroupId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  productOptionId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId!: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemOptionSelectionDto)
  selectedOptions?: CreateOrderItemOptionSelectionDto[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderContactDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  buyerName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  buyerPhone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  receiverName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  receiverPhone!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  zipcode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address1!: string;

  @IsOptional()
  @IsString()
  @IsIn(['R', 'J'])
  userSelectedType?: 'R' | 'J';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  roadAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  jibunAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  address2?: string;
}

export class CreateRefundPolicyConsentDto {
  @IsBoolean()
  agreed!: boolean;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  version!: string;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

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
