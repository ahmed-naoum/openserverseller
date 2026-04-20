-- AlterTable
ALTER TABLE "affiliate_claims" ADD COLUMN     "brandingLabelMockupUrl" TEXT,
ADD COLUMN     "brandingLabelPrintUrl" TEXT;

-- AlterTable
ALTER TABLE "product_inventory" ADD COLUMN     "brandingLabelMockupUrl" TEXT,
ADD COLUMN     "brandingLabelPrintUrl" TEXT;
