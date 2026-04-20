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
    };
  }
}

export {};
