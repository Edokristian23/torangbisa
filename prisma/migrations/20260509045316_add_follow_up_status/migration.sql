-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('DONE', 'NOT_DONE');

-- AlterTable
ALTER TABLE "FollowUpEntry" ADD COLUMN     "followUpStatus" "FollowUpStatus" NOT NULL DEFAULT 'DONE',
ADD COLUMN     "pendingReason" TEXT;

-- CreateIndex
CREATE INDEX "FollowUpEntry_followUpStatus_idx" ON "FollowUpEntry"("followUpStatus");
