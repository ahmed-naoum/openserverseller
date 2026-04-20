import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function checkAndActivateUser(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { bankAccounts: true }
  });

  if (!user) return;

  const isEmailVerified = user.emailVerifiedAt !== null;
  const isKycApproved = user.kycStatus === 'APPROVED';
  const hasApprovedBank = user.bankAccounts.some((ba: any) => ba.status === 'APPROVED');
  const isContractSigned = user.contractAccepted === true;

  const shouldBeActive = isEmailVerified && isKycApproved && hasApprovedBank && isContractSigned;

  if (user.isActive !== shouldBeActive) {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: shouldBeActive }
    });
  }
}
