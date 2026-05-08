-- CreateEnum
CREATE TYPE "GuideCategory" AS ENUM ('PETUNJUK_TOOLS', 'PERATURAN_MR', 'BAHAN_PEMBELAJARAN', 'CONTOH_DOKUMEN');

-- AlterTable
ALTER TABLE "GuideDocument" ADD COLUMN     "category" "GuideCategory" NOT NULL DEFAULT 'PETUNJUK_TOOLS';

-- CreateIndex
CREATE INDEX "GuideDocument_category_idx" ON "GuideDocument"("category");

-- CreateIndex
CREATE INDEX "GuideDocument_category_isActive_idx" ON "GuideDocument"("category", "isActive");
