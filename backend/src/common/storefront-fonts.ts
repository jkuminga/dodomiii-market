export const STORE_WEB_FONT_FAMILIES = [
  'HANAM_DAUM',
  'MARUMINYA',
  'NANUM_BARUNPEN',
  'HAKGYOANSIM_KKOKOMA',
  'HS_SAEMAEUL',
  'HAKGYOANSIM_NADEURI',
  'PRETENDARD',
] as const;

export type StoreWebFontFamily = (typeof STORE_WEB_FONT_FAMILIES)[number];

export const STORE_WEB_FONT_WEIGHT_PRESETS = ['NORMAL', 'LIGHT', 'STRONG'] as const;

export type StoreWebFontWeightPreset = (typeof STORE_WEB_FONT_WEIGHT_PRESETS)[number];
