import { prisma } from '../lib/prisma.js';


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
  const hasSubdomain = user.subdomain !== null && user.subdomain !== undefined && user.subdomain !== '';

  const shouldBeActive = hasSubdomain && isEmailVerified && isKycApproved && hasApprovedBank && isContractSigned;

  if (shouldBeActive && !user.isActive) {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: true }
    });
  }
}
