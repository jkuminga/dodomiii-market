import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CustomCheckoutTokenParamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  token!: string;
}
