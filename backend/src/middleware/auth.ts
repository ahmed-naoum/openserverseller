import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    list[parts.shift()!.trim()] = decodeURIComponent(parts.join('='));
  });
  return list;
};

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie);
      token = cookies.token || '';
    } else if (req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required. Please log in.',
      });
    }
    const jwt = require('jsonwebtoken');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      isImpersonated?: boolean;
    };

    const user = await prisma.user.findUnique({
      where: { uuid: decoded.userId },
      include: { role: true },
    });

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found. Please log in again.',
      });
    }

    // Removed global active check to allow unverified users to access dashboard and verification routes.

    req.user = {
      id: user.id,
      uuid: user.uuid,
      email: user.email,
      phone: user.phone,
      roleId: user.roleId,
      roleName: user.role.name,
      mode: user.mode,
      isInfluencer: user.isInfluencer,
      canImpersonate: user.canImpersonate,
      canManageProducts: user.canManageProducts,
      canManageLeads: user.canManageLeads,
      canManageOrders: user.canManageOrders,
      canManageInfluencerLinks: user.canManageInfluencerLinks,
      canDisplayOnDashboard: user.canDisplayOnDashboard,
      isImpersonated: decoded.isImpersonated || false,
    };

    // If impersonated, block mutating actions (POST, PUT, PATCH, DELETE) except logout
    if (
      req.user.isImpersonated &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase()) &&
      !req.path.includes('/auth/logout')
    ) {
      return res.status(403).json({
        status: 'error',
        message: 'Lecture seule : Les modifications ne sont pas autorisées en mode assistance.',
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({
      status: 'error',
      message: 'Invalid or expired token. Please log in again.',
    });
  }
};

export const authorize = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.roleName)) {
      return res.status(403).json({
        status: 'error',
        message: 'You do not have permission to perform this action.',
      });
    }

    next();
  };
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    let token = '';

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.headers.cookie) {
      const cookies = parseCookies(req.headers.cookie);
      token = cookies.token || '';
    }
    
    if (!token) {
      return next();
    }

    const jwt = require('jsonwebtoken');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      isImpersonated?: boolean;
    };

    const user = await prisma.user.findUnique({
      where: { uuid: decoded.userId },
      include: { role: true },
    });

    if (user && user.isActive) {
      req.user = {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        phone: user.phone,
        roleId: user.roleId,
        roleName: user.role.name,
        mode: user.mode,
        isInfluencer: user.isInfluencer,
        canImpersonate: user.canImpersonate,
        canManageProducts: user.canManageProducts,
        canManageLeads: user.canManageLeads,
        canManageOrders: user.canManageOrders,
        canManageInfluencerLinks: user.canManageInfluencerLinks,
        canDisplayOnDashboard: user.canDisplayOnDashboard,
        isImpersonated: decoded.isImpersonated || false,
      };
    }

    next();
  } catch {
    next();
  }
};
