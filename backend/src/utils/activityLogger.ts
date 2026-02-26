import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const logActivity = async (
  userId: bigint | null,
  action: string,
  modelType?: string,
  modelId?: bigint,
  changes?: any
) => {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        modelType,
        modelId,
        changes,
      },
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

export const activityLogger = (action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        logActivity(
          req.user.id,
          action,
          req.baseUrl.split('/').pop(),
          body?.data?.id ? BigInt(body.data.id) : undefined,
          { body: req.body, params: req.params, query: req.query }
        ).catch(console.error);
      }
      return originalJson(body);
    };

    next();
  };
};

export const formatActivityAction = (action: string): string => {
  const actionMap: Record<string, string> = {
    'POST': 'Création',
    'PUT': 'Modification',
    'PATCH': 'Mise à jour',
    'DELETE': 'Suppression',
    'GET': 'Consultation',
  };

  for (const [method, label] of Object.entries(actionMap)) {
    if (action.includes(method)) {
      return `${label} ${action.replace(method, '').trim()}`;
    }
  }

  return action;
};
