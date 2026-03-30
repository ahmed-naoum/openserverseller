import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Create an announcement (Admin Only)
export const createAnnouncement = async (req: Request, res: Response) => {
  try {
    const { type, severity, priority, placement, targetRole, targetUserId, title, content } = req.body;

    if (!['GLOBAL', 'ROLE', 'USER'].includes(type)) {
      res.status(400).json({ success: false, message: 'Invalid announcement type' });
      return;
    }

    if (severity && !['INFO', 'WARNING', 'IMPORTANT'].includes(severity)) {
      res.status(400).json({ success: false, message: 'Invalid severity type' });
      return;
    }

    if (placement && !['TOP', 'BOTTOM'].includes(placement)) {
      res.status(400).json({ success: false, message: 'Invalid placement type' });
      return;
    }

    if (type === 'ROLE' && !targetRole) {
      res.status(400).json({ success: false, message: 'targetRole is required for ROLE type announcements' });
      return;
    }

    if (type === 'USER' && !targetUserId) {
      res.status(400).json({ success: false, message: 'targetUserId is required for USER type announcements' });
      return;
    }

    const announcement = await prisma.announcement.create({
      data: {
        type,
        severity: severity || 'INFO',
        priority: priority ? parseInt(priority) : 0,
        placement: placement || 'TOP',
        targetRole,
        targetUserId: targetUserId ? parseInt(targetUserId) : null,
        title,
        content
      }
    });

    res.status(201).json({ success: true, data: announcement });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to create announcement' });
  }
};

// Get current active announcements (For User)
export const getMyAnnouncements = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.roleName;

    if (!userId || !userRole) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const announcements = await prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [
          { type: 'GLOBAL' },
          { type: 'ROLE', targetRole: userRole },
          { type: 'USER', targetUserId: userId }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: announcements });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
  }
};

// Get all announcements (Admin Only)
export const getAllAnnouncements = async (req: Request, res: Response) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' }
      ],
      include: {
        targetUser: {
          select: {
            email: true,
            profile: { select: { fullName: true } }
          }
        }
      }
    });
    res.json({ success: true, data: announcements });
  } catch (error) {
    console.error('Get all announcements error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
  }
}

// Delete or toggle announcement (Admin Only)
export const toggleAnnouncement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const announcement = await prisma.announcement.update({
      where: { id: parseInt(id as string) },
      data: { isActive }
    });

    res.json({ success: true, data: announcement });
  } catch (error) {
    console.error('Toggle announcement error:', error);
    res.status(500).json({ success: false, message: 'Failed to update announcement' });
  }
}

export const deleteAnnouncement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.announcement.delete({
      where: { id: parseInt(id as string) }
    });

    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error deleting announcement' });
  }
};

// Update an announcement (Admin Only)
export const updateAnnouncement = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, severity, priority, placement, targetRole, targetUserId, title, content } = req.body;

    if (type && !['GLOBAL', 'ROLE', 'USER'].includes(type)) {
      res.status(400).json({ success: false, message: 'Invalid announcement type' });
      return;
    }

    if (severity && !['INFO', 'WARNING', 'IMPORTANT'].includes(severity)) {
      res.status(400).json({ success: false, message: 'Invalid severity type' });
      return;
    }

    if (placement && !['TOP', 'BOTTOM'].includes(placement)) {
      res.status(400).json({ success: false, message: 'Invalid placement type' });
      return;
    }

    const data: any = {
      title,
      content,
      type,
      severity,
      priority: priority !== undefined ? parseInt(priority) : undefined,
      placement,
      targetRole: type === 'ROLE' ? targetRole : (type ? null : undefined),
      targetUserId: type === 'USER' ? (targetUserId ? parseInt(targetUserId as string) : null) : (type ? null : undefined)
    };

    // Remove undefined fields to avoid overwriting with null if they weren't provided in partial update
    Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

    const announcement = await prisma.announcement.update({
      where: { id: parseInt(id as string) },
      data
    });

    res.json({ success: true, data: announcement });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating announcement' });
  }
};
