import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { checkAndActivateUser } from '../utils/verification.js';
import { getSecret } from '../lib/secretStore.js';

const router = Router();

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { event, transactionId, fileId } = req.body;

    console.log(`[DamaneSign Webhook] Event: ${event}, Transaction: ${transactionId}`);

    if (!transactionId) {
      return res.status(400).json({ error: 'Missing transactionId' });
    }

    const user = await prisma.user.findFirst({
      where: { damanesignTransactionId: transactionId },
    });

    if (!user) {
      console.warn(`[DamaneSign Webhook] No user found for transactionId: ${transactionId}`);
      return res.status(404).json({ error: 'User not found for transaction' });
    }

    if (event === 'TRANSACTION_FINISHED' || event === 'MEMBER_FINISHED') {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          contractAccepted: true,
          contractSignedAt: new Date(),
        },
      });

      await checkAndActivateUser(user.id);
      console.log(`[DamaneSign Webhook] User ${user.id} contract signing marked as complete.`);

      if (fileId) {
        const downloadUrl = `${getSecret('DAMANESIGN_API_URL') || 'https://api-recette.damanesign.ma'}/files/${fileId}/download`;
        await prisma.user.update({
          where: { id: user.id },
          data: {
            damanesignSignedFileUrl: downloadUrl,
          },
        });
      }
    } else if (event === 'TRANSACTION_REFUSED' || event === 'TRANSACTION_EXPIRED') {
      console.log(`[DamaneSign Webhook] Transaction ${event} for user ${user.id}`);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          damanesignTransactionId: null,
          damanesignMemberId: null,
          damanesignFileId: null,
        },
      });
    }

    res.json({ status: 'success' });
  })
);

export default router;
