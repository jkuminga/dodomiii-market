import type {
  AdminRole,
  DepositStatus,
  OrderStatus,
  ProductImageType,
  ShipmentStatus,
} from '@prisma/client';

export type AdminCategoryResponse = {
  id: number;
  parentId: number | null;
  parentName: string | null;
  name: string;
  slug: string;
  imageUrl: string | null;
  isOnLandingPage: boolean;
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

export type AdminOrderListItemResponse = {
  id: number;
  orderNumber: string;
  orderStatus: OrderStatus;
  itemCount: number;
  totalQuantity: number;
  totalProductPrice: number;
  shippingFee: number;
  finalTotalPrice: number;
  buyerName: string | null;
  buyerPhone: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  depositStatus: DepositStatus | null;
  shipmentStatus: ShipmentStatus;
  trackingNumber: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminOrderContactResponse = {
  buyerName: string;
  buyerPhone: string;
  receiverName: string;
  receiverPhone: string;
  zipcode: string;
  address1: string;
  address2: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminOrderDepositResponse = {
  depositStatus: DepositStatus;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  expectedAmount: number;
  depositorName: string | null;
  requestedAt: string | null;
  confirmedAt: string | null;
  depositDeadlineAt: string | null;
  adminMemo: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminOrderShipmentResponse = {
  shipmentStatus: ShipmentStatus;
  courierName: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminOrderStatusHistoryResponse = {
  orderStatusHistoryId: number;
  changedByAdminId: number | null;
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  changeReason: string | null;
  createdAt: string;
  admin: {
    id: number;
    loginId: string;
    name: string;
    role: AdminRole;
  } | null;
};

export type AdminOrderDetailResponse = {
  orderId: number;
  orderNumber: string;
  orderStatus: OrderStatus;
  customerRequest: string | null;
  pricing: {
    totalProductPrice: number;
    shippingFee: number;
    finalTotalPrice: number;
  };
  depositDeadlineAt: string | null;
  paymentRequestedAt: string | null;
  paymentConfirmedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  allowedNextStatuses: OrderStatus[];
  items: Array<{
    orderItemId: number;
    productId: number;
    productOptionId: number | null;
    productNameSnapshot: string;
    optionNameSnapshot: string | null;
    optionValueSnapshot: string | null;
    unitPrice: number;
    quantity: number;
    lineTotalPrice: number;
    product: {
      id: number;
      name: string;
      slug: string;
      deletedAt: string | null;
    };
    productOption: {
      id: number;
      optionGroupName: string;
      optionValue: string;
      isActive: boolean;
    } | null;
  }>;
  contact: AdminOrderContactResponse;
  deposit: AdminOrderDepositResponse;
  shipment: AdminOrderShipmentResponse;
  statusHistories: AdminOrderStatusHistoryResponse[];
  createdAt: string;
  updatedAt: string;
};

export type AdminCustomOrderLinkResponse = {
  linkId: number;
  token: string;
  checkoutUrl: string;
  productName: string;
  note: string | null;
  totalProductPrice: number;
  shippingFee: number;
  finalTotalPrice: number;
  isActive: boolean;
  isExpired: boolean;
  isAvailable: boolean;
  isUsed: boolean;
  usageCount: number;
  usedAt: string | null;
  usedOrderId: number | null;
  usedOrderNumber: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type AdminHomePopupResponse = {
  id: number;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
