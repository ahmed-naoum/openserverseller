import { z } from 'zod';

export const phoneSchema = z.string().refine(
  (val) => /^\+212[5678][0-9]{8}$/.test(val) || /^0[5678][0-9]{8}$/.test(val),
  { message: 'Invalid Moroccan phone number format' }
);

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .refine(
    (val) => /[A-Z]/.test(val),
    'Password must contain at least one uppercase letter'
  )
  .refine(
    (val) => /[a-z]/.test(val),
    'Password must contain at least one lowercase letter'
  )
  .refine(
    (val) => /[0-9]/.test(val),
    'Password must contain at least one number'
  );

export const emailSchema = z.string().email('Invalid email format');

export const registerSchema = z.object({
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  password: passwordSchema,
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  role: z.enum(['VENDOR', 'GROSSELLER', 'CALL_CENTER_AGENT', 'CONFIRMATION_AGENT', 'INFLUENCER']).default('VENDOR'),
}).refine((data) => data.email || data.phone, {
  message: 'Email or phone is required',
  path: ['email'],
});

export const loginSchema = z.object({
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  password: z.string().min(1, 'Password is required'),
}).refine((data) => data.email || data.phone, {
  message: 'Email or phone is required',
  path: ['email'],
});

export const productSchema = z.object({
  nameAr: z.string().min(2, 'Arabic name is required').max(200),
  nameFr: z.string().min(2, 'French name is required').max(200),
  nameEn: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  categoryIds: z.array(z.number().int().positive()).min(1, 'At least one category required'),
  baseCostMad: z.number().positive('Base cost must be positive'),
  retailPriceMad: z.number().positive('Retail price must be positive'),
  minProductionDays: z.number().int().min(1).max(365).default(3),
  visibility: z.enum(['REGULAR', 'AFFILIATE', 'NONE']).default('REGULAR'),
  isCustomizable: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const leadSchema = z.object({
  fullName: z.string().min(2, 'Full name required').max(100),
  phone: phoneSchema,
  whatsapp: phoneSchema.optional(),
  city: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  brandId: z.number().int().positive().optional(),
});

export const orderSchema = z.object({
  brandId: z.number().int().positive('Brand required'),
  customerName: z.string().min(2).max(100),
  customerPhone: phoneSchema,
  customerCity: z.string().min(2).max(100),
  customerAddress: z.string().min(5).max(500),
  paymentMethod: z.enum(['COD', 'BANK_TRANSFER', 'ONLINE']).default('COD'),
  items: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive().max(100),
  })).min(1, 'At least one item required'),
});

export const brandSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with dashes'),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  slogan: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  bankName: z.string().max(100).optional(),
  ribAccount: z.string().regex(/^[0-9]{24}$/).optional(),
  iceNumber: z.string().regex(/^[0-9]{15}$/).optional(),
});

export const payoutRequestSchema = z.object({
  amountMad: z.number().positive('Amount must be positive'),
  bankName: z.string().min(2).max(100),
  ribAccount: z.string().regex(/^[0-9]{24}$/, 'Invalid RIB format'),
  iceNumber: z.string().regex(/^[0-9]{15}$/).optional(),
});

export const userProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  city: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  language: z.enum(['fr', 'ar', 'en']).default('fr'),
});

export const kycDocumentSchema = z.object({
  documentType: z.enum(['IDENTITY', 'PASSPORT', 'DRIVERS_LICENSE', 'RESIDENCE_PROOF', 'BANK_STATEMENT']),
  documentUrl: z.string().url('Valid URL required'),
});

export const switchModeSchema = z.object({
  mode: z.enum(['SELLER', 'AFFILIATE']),
});

export const referralLinkSchema = z.object({
  productId: z.number().int().positive('Valid product required'),
});

export const campaignJoinSchema = z.object({
  productIds: z.array(z.number().int().positive()).min(1).max(50),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type LeadInput = z.infer<typeof leadSchema>;
export type OrderInput = z.infer<typeof orderSchema>;
export type BrandInput = z.infer<typeof brandSchema>;
export type PayoutRequestInput = z.infer<typeof payoutRequestSchema>;
export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type KycDocumentInput = z.infer<typeof kycDocumentSchema>;
export type SwitchModeInput = z.infer<typeof switchModeSchema>;
export type ReferralLinkInput = z.infer<typeof referralLinkSchema>;
export type CampaignJoinInput = z.infer<typeof campaignJoinSchema>;
