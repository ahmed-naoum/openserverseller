export interface User {
  uuid: string;
  email: string | null;
  phone: string | null;
  fullName?: string;
  avatarUrl?: string;
  city?: string;
  role: string;
  roleName?: string;
  kycStatus: string;
  isActive: boolean;
  mode?: 'SELLER' | 'AFFILIATE';
  isInfluencer?: boolean;
  instagramUsername?: string;
  tiktokUsername?: string;
  facebookUsername?: string;
  referralCode?: string;
  wallet?: {
    balanceMad: number | string;
    totalEarnedMad: number | string;
    totalWithdrawnMad: number | string;
  };
  brand?: {
    id: string;
    name: string;
    slug: string;
  };
}

export type UserRole =
  | 'VENDOR'
  | 'GROSSELLER'
  | 'CALL_CENTER_AGENT'
  | 'CONFIRMATION_AGENT'
  | 'INFLUENCER'
  | 'SUPER_ADMIN'
  | 'ADMIN';

export const ROLE_LABELS: Record<UserRole, { ar: string; fr: string; icon: string }> = {
  VENDOR: { ar: 'بائع/موزع', fr: 'Vendeur', icon: 'user' },
  GROSSELLER: { ar: 'تاجر جملة', fr: 'Grossiste', icon: 'briefcase' },
  CALL_CENTER_AGENT: { ar: 'وكيل اتصال', fr: 'Agent Call Center', icon: 'headphones' },
  CONFIRMATION_AGENT: { ar: 'وكيل تأكيد', fr: 'Agent Confirmation', icon: 'check-square' },
  INFLUENCER: { ar: 'مؤثر', fr: 'Influenceur', icon: 'megaphone' },
  SUPER_ADMIN: { ar: 'مدير النظام', fr: 'Super Admin', icon: 'settings' },
  ADMIN: { ar: 'مدير', fr: 'Admin', icon: 'shield' },
};

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  slogan?: string;
  description?: string;
  status: string;
  isApproved: boolean;
}

export interface Product {
  id: string;
  sku: string;
  nameAr: string;
  nameFr: string;
  nameEn?: string;
  description?: string;
  baseCostMad: number | string;
  retailPriceMad: number | string;
  isCustomizable: boolean;
  minProductionDays: number;
  visibility: 'REGULAR' | 'AFFILIATE' | 'NONE';
  category?: Category;
  primaryImage?: string;
  variants?: ProductVariant[];
  images?: ProductImage[];
}

export interface Category {
  id: string;
  nameAr: string;
  nameFr: string;
  nameEn?: string;
  slug: string;
  imageUrl?: string;
}

export interface ProductVariant {
  id: string;
  variantName: string;
  sku: string;
  priceAdjustmentMad: number | string;
  stockQuantity: number;
}

export interface ProductImage {
  id: string;
  imageUrl: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface Lead {
  id: string;
  fullName: string;
  phone: string;
  whatsapp?: string;
  city?: string;
  address?: string;
  status: string;
  conversionProbability?: number;
  notes?: string;
  brand?: { id: string; name: string };
  assignedAgent?: { uuid: string; fullName: string };
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerCity: string;
  customerAddress?: string;
  totalAmountMad: number | string;
  vendorEarningMad: number | string;
  platformFeeMad: number | string;
  status: string;
  paymentMethod: string;
  brand: { id: string; name: string };
  items: OrderItem[];
  shipment?: Shipment;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  productName: string;
  productImage?: string;
  quantity: number;
  unitPriceMad: number | string;
  totalPriceMad: number | string;
}

export interface Shipment {
  trackingNumber?: string;
  status: string;
  courier: string;
}

export interface Wallet {
  id: string;
  balanceMad: number | string;
  totalEarnedMad: number | string;
  totalWithdrawnMad: number | string;
  transactions?: WalletTransaction[];
}

export interface WalletTransaction {
  id: string;
  type: string;
  amountMad: number | string;
  balanceAfterMad: number | string;
  description?: string;
  order?: { orderNumber: string; brand?: string };
  createdAt: string;
}

export interface PayoutRequest {
  id: string;
  amountMad: number | string;
  status: string;
  bankName: string;
  bankIce?: string;
  ribAccount: string;
  processedAt?: string;
  receiptUrl?: string;
  createdAt: string;
}

export interface MoroccanCity {
  id: string;
  nameAr: string;
  nameFr: string;
  nameEn?: string;
  region?: string;
  isMajor: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type LeadStatus =
  | 'NEW'
  | 'ASSIGNED'
  | 'CONTACTED'
  | 'INTERESTED'
  | 'NOT_INTERESTED'
  | 'CALLBACK_REQUESTED'
  | 'ORDERED'
  | 'UNREACHABLE'
  | 'INVALID';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PRODUCTION'
  | 'READY_FOR_SHIPPING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'
  | 'REFUNDED';

export type PayoutStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED';

export const LEAD_STATUS_LABELS: Record<LeadStatus, { ar: string; fr: string; color: string }> = {
  NEW: { ar: 'جديد', fr: 'Nouveau', color: 'blue' },
  ASSIGNED: { ar: 'معين', fr: 'Assigné', color: 'purple' },
  CONTACTED: { ar: 'تم التواصل', fr: 'Contacté', color: 'yellow' },
  INTERESTED: { ar: 'مهتم', fr: 'Intéressé', color: 'green' },
  NOT_INTERESTED: { ar: 'غير مهتم', fr: 'Pas intéressé', color: 'red' },
  CALLBACK_REQUESTED: { ar: 'طلب إعادة الاتصال', fr: 'Rappel demandé', color: 'orange' },
  ORDERED: { ar: 'طلب', fr: 'Commandé', color: 'emerald' },
  UNREACHABLE: { ar: 'لا يمكن الوصول', fr: 'Injoignable', color: 'gray' },
  INVALID: { ar: 'غير صالح', fr: 'Invalide', color: 'red' },
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, { ar: string; fr: string; color: string }> = {
  PENDING: { ar: 'قيد الانتظار', fr: 'En attente', color: 'yellow' },
  CONFIRMED: { ar: 'مؤكد', fr: 'Confirmé', color: 'blue' },
  IN_PRODUCTION: { ar: 'قيد الإنتاج', fr: 'En production', color: 'purple' },
  READY_FOR_SHIPPING: { ar: 'جاهز للشحن', fr: 'Prêt à expédier', color: 'indigo' },
  SHIPPED: { ar: 'تم الشحن', fr: 'Expédié', color: 'cyan' },
  DELIVERED: { ar: 'تم التسليم', fr: 'Livré', color: 'green' },
  CANCELLED: { ar: 'ملغي', fr: 'Annulé', color: 'red' },
  RETURNED: { ar: 'مرتجع', fr: 'Retourné', color: 'orange' },
  REFUNDED: { ar: 'مسترد', fr: 'Remboursé', color: 'gray' },
};

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, { ar: string; fr: string; color: string }> = {
  PENDING: { ar: 'قيد الانتظار', fr: 'En attente', color: 'yellow' },
  APPROVED: { ar: 'موافق عليه', fr: 'Approuvé', color: 'blue' },
  PROCESSING: { ar: 'قيد المعالجة', fr: 'En cours', color: 'purple' },
  COMPLETED: { ar: 'مكتمل', fr: 'Complété', color: 'green' },
  REJECTED: { ar: 'مرفوض', fr: 'Rejeté', color: 'red' },
  CANCELLED: { ar: 'ملغي', fr: 'Annulé', color: 'gray' },
};

export interface ReferralLink {
  id: string;
  influencerId: string;
  productId: string;
  product?: Product;
  code: string;
  clicks: number;
  conversions: number;
  earnings: number;
  isActive: boolean;
  createdAt: string;
}



export interface InfluencerCommission {
  id: string;
  influencerId: string;
  referralLinkId: string;
  referralLink: ReferralLink & { product: Product };
  orderId?: string;
  order?: Order;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'PAID';
  paidAt?: string;
  createdAt: string;
}
