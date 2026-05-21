import { UserWebFontSize } from '@prisma/client';
import { IsEnum, IsIn } from 'class-validator';

import {
  STORE_WEB_FONT_FAMILIES,
  STORE_WEB_FONT_WEIGHT_PRESETS,
  StoreWebFontFamily,
  StoreWebFontWeightPreset,
} from '../../../common/storefront-fonts';

export class UpdateAdminStorefrontSettingsDto {
  @IsEnum(UserWebFontSize)
  userWebFontSize!: UserWebFontSize;

  @IsIn(STORE_WEB_FONT_FAMILIES)
  userWebFontFamily!: StoreWebFontFamily;

  @IsIn(STORE_WEB_FONT_WEIGHT_PRESETS)
  userWebFontWeightPreset!: StoreWebFontWeightPreset;
}
