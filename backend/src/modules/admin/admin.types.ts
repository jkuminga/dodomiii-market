import type { ProductImageType } from '@prisma/client';

export type AdminCategoryResponse = {
  id: number;
  parentId: number | null;
  parentName: string | null;
  name: string;
  slug: string;
  depth: number;
  path: string;
  sortOrder: number;
  isVisible: boolean;
  childCount: number;
  totalProductCount: number;
  activeProductCount: number;
  deletedProductCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminProductImageResponse = {
  id: number;
  imageType: ProductImageType;
  imageUrl: string;
  sortOrder: number;
  createdAt: string;
};

export type AdminProductOptionResponse = {
  id: number;
  optionGroupName: string;
  optionValue: string;
  extraPrice: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminProductListItemResponse = {
  id: number;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  basePrice: number;
  isVisible: boolean;
  isSoldOut: boolean;
  consultationRequired: boolean;
  stockQuantity: number | null;
  thumbnailImageUrl: string | null;
  imageCount: number;
  optionCount: number;
  orderItemCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type AdminProductDetailResponse = {
  id: number;
  category: {
    id: number;
    name: string;
    slug: string;
    parentId: number | null;
    isVisible: boolean;
  };
  name: string;
  slug: string;
  shortDescription: string | null;
  description: string | null;
  basePrice: number;
  isVisible: boolean;
  isSoldOut: boolean;
  consultationRequired: boolean;
  stockQuantity: number | null;
  images: AdminProductImageResponse[];
  options: AdminProductOptionResponse[];
  orderItemCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
