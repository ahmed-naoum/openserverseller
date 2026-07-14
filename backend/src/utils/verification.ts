import { prisma } from '../lib/prisma.js';
import { fetchMaintenanceSettings } from '../middleware/maintenance.js';


export async function checkAndActivateUser(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { bankAccounts: true }
  });

  if (!user) return;

  const settings = await fetchMaintenanceSettings();
  const showIdentity = settings.showIdentityVerification !== false;
  const showBank = settings.showBankVerification !== false;
  const showContract = settings.showContractVerification !== false;

  const isEmailVerified = user.emailVerifiedAt !== null;
  const isKycApproved = !showIdentity || user.kycStatus === 'APPROVED';
  const hasApprovedBank = !showBank || user.bankAccounts.some((ba: any) => ba.status === 'APPROVED');
  const isContractSigned = !showContract || user.contractAccepted === true;
  const hasSubdomain = user.subdomain !== null && user.subdomain !== undefined && user.subdomain !== '';

  const shouldBeActive = hasSubdomain && isEmailVerified && isKycApproved && hasApprovedBank && isContractSigned;

  if (shouldBeActive && !user.isActive) {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: true }
    });
  }
}
