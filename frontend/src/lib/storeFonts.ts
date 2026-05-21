import type { StoreWebFontFamily, StoreWebFontWeightPreset } from './api';

export type StoreWebFontOption = {
  value: StoreWebFontFamily;
  label: string;
  cssFamily: string;
  attribute: string;
  supportsWeightPreset: boolean;
};

export type StoreWebFontWeightOption = {
  value: StoreWebFontWeightPreset;
  label: string;
  description: string;
  attribute: string;
  previewWeight: number;
};

export const STORE_WEB_FONT_OPTIONS: StoreWebFontOption[] = [
  {
    value: 'HANAM_DAUM',
    label: '하남다움체',
    cssFamily: 'HanamDaum',
    attribute: 'hanam-daum',
    supportsWeightPreset: false,
  },
  {
    value: 'MARUMINYA',
    label: '마루미냐체',
    cssFamily: 'Maruminya',
    attribute: 'maruminya',
    supportsWeightPreset: false,
  },
  {
    value: 'NANUM_BARUNPEN',
    label: '나눔바른펜',
    cssFamily: 'NanumBarunpen',
    attribute: 'nanum-barunpen',
    supportsWeightPreset: true,
  },
  {
    value: 'HAKGYOANSIM_KKOKOMA',
    label: '학교안심 꼬꼬마',
    cssFamily: 'HakgyoansimKkokoma',
    attribute: 'hakgyoansim-kkokoma',
    supportsWeightPreset: false,
  },
  {
    value: 'HS_SAEMAEUL',
    label: 'HS새마을체',
    cssFamily: 'HSSaemaeul',
    attribute: 'hs-saemaeul',
    supportsWeightPreset: false,
  },
  {
    value: 'HAKGYOANSIM_NADEURI',
    label: '학교안심 나들이',
    cssFamily: 'HakgyoansimNadeuri',
    attribute: 'hakgyoansim-nadeuri',
    supportsWeightPreset: false,
  },
  {
    value: 'PRETENDARD',
    label: '프리텐다드',
    cssFamily: 'Pretendard',
    attribute: 'pretendard',
    supportsWeightPreset: true,
  },
];

export const STORE_WEB_FONT_WEIGHT_OPTIONS: StoreWebFontWeightOption[] = [
  {
    value: 'LIGHT',
    label: '가볍게',
    description: '본문과 강조 텍스트를 한 단계 얇게 표시합니다.',
    attribute: 'light',
    previewWeight: 350,
  },
  {
    value: 'NORMAL',
    label: '기본',
    description: '현재 디자인에 맞춘 표준 굵기입니다.',
    attribute: 'normal',
    previewWeight: 500,
  },
  {
    value: 'STRONG',
    label: '또렷하게',
    description: '버튼과 제목의 인상을 조금 더 선명하게 표시합니다.',
    attribute: 'strong',
    previewWeight: 650,
  },
];

export const DEFAULT_STORE_WEB_FONT_FAMILY: StoreWebFontFamily = 'HANAM_DAUM';
export const DEFAULT_STORE_WEB_FONT_WEIGHT_PRESET: StoreWebFontWeightPreset = 'NORMAL';

export const STORE_WEB_FONT_ATTRIBUTE: Record<StoreWebFontFamily, string> = STORE_WEB_FONT_OPTIONS.reduce(
  (accumulator, option) => ({
    ...accumulator,
    [option.value]: option.attribute,
  }),
  {} as Record<StoreWebFontFamily, string>,
);

export const STORE_WEB_FONT_WEIGHT_ATTRIBUTE: Record<StoreWebFontWeightPreset, string> = STORE_WEB_FONT_WEIGHT_OPTIONS.reduce(
  (accumulator, option) => ({
    ...accumulator,
    [option.value]: option.attribute,
  }),
  {} as Record<StoreWebFontWeightPreset, string>,
);
