import { AdminRole } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAdminAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  loginId?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  depositBankName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  depositAccountHolder?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  depositAccountNumber?: string | null;

  @IsOptional()
  @IsBoolean()
  isPrimaryDepositAccount?: boolean;
}
