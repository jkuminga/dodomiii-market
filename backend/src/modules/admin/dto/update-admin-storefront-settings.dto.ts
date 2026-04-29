import { UserWebFontSize } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateAdminStorefrontSettingsDto {
  @IsEnum(UserWebFontSize)
  userWebFontSize!: UserWebFontSize;
}
