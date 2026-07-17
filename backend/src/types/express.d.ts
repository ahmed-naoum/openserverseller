import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        uuid: string;
        email: string | null;
        phone: string | null;
        roleId: number;
        roleName: string;
        mode: string;
        isInfluencer: boolean;
        canImpersonate: boolean;
        canManageProducts: boolean;
        canManageLeads: boolean;
        canManageOrders: boolean;
        canManageInfluencerLinks: boolean;
        canDisplayOnDashboard: boolean;
        isImpersonated?: boolean;
      };
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: number;
      uuid: string;
      email: string | null;
      phone: string | null;
      roleId: number;
      roleName: string;
      mode: string;
      isInfluencer: boolean;
      canImpersonate: boolean;
      canManageProducts: boolean;
      canManageLeads: boolean;
      canManageOrders: boolean;
      canManageInfluencerLinks: boolean;
      canDisplayOnDashboard: boolean;
      isImpersonated?: boolean;
    };
  }
}

export {};
