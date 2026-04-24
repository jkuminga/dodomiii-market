import type { ProductImageType, ProductOptionSelectionType } from '@prisma/client';

export type AdminProductImageInput = {
  imageType: ProductImageType;
  imageUrl: string;
  sortOrder?: number;
};

export type NormalizedAdminProductImage = {
  imageType: ProductImageType;
  imageUrl: string;
  sortOrder: number;
};

export type AdminProductOptionInput = {
  name: string;
  extraPrice?: number;
  maxQuantity?: number | null;
  isActive?: boolean;
  sortOrder?: number;
};

export type AdminProductOptionGroupInput = {
  name: string;
  selectionType: ProductOptionSelectionType;
  isRequired?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  options: AdminProductOptionInput[];
};

export type NormalizedAdminProductOption = {
  name: string;
  extraPrice: number;
  maxQuantity: number | null;
  isActive: boolean;
  sortOrder: number;
};

export type NormalizedAdminProductOptionGroup = {
  name: string;
  selectionType: ProductOptionSelectionType;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  options: NormalizedAdminProductOption[];
};

export function normalizeProductImages(
  images: AdminProductImageInput[],
): NormalizedAdminProductImage[] {
  return images.map((image, index) => ({
    imageType: image.imageType,
    imageUrl: image.imageUrl,
    sortOrder: image.sortOrder ?? index,
  }));
}

export function normalizeProductOptionGroups(
  optionGroups: AdminProductOptionGroupInput[],
): NormalizedAdminProductOptionGroup[] {
  return optionGroups.map((group, groupIndex) => ({
    name: group.name,
    selectionType: group.selectionType,
    isRequired: group.isRequired ?? false,
    isActive: group.isActive ?? true,
    sortOrder: group.sortOrder ?? groupIndex,
    options: group.options.map((option, optionIndex) => ({
      name: option.name,
      extraPrice: option.extraPrice ?? 0,
      maxQuantity: option.maxQuantity ?? null,
      isActive: option.isActive ?? true,
      sortOrder: option.sortOrder ?? optionIndex,
    })),
  }));
}
