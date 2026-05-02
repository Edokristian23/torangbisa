/*
  Warnings:

  - Made the column `reviewStatus` on table `AssessmentResponse` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "AssessmentResponse" ADD COLUMN     "createdByName" TEXT,
ADD COLUMN     "createdByRole" TEXT,
ALTER COLUMN "reviewStatus" SET NOT NULL;

-- CreateIndex
CREATE INDEX "AssessmentPeriod_submittedById_idx" ON "AssessmentPeriod"("submittedById");

-- CreateIndex
CREATE INDEX "AssessmentPeriod_reviewedById_idx" ON "AssessmentPeriod"("reviewedById");

-- CreateIndex
CREATE INDEX "AssessmentResponse_assessmentPeriodId_idx" ON "AssessmentResponse"("assessmentPeriodId");

-- CreateIndex
CREATE INDEX "AssessmentResponse_parameterId_idx" ON "AssessmentResponse"("parameterId");

-- CreateIndex
CREATE INDEX "AssessmentResponse_sortOrder_idx" ON "AssessmentResponse"("sortOrder");

-- CreateIndex
CREATE INDEX "AssessmentResponse_reviewStatus_idx" ON "AssessmentResponse"("reviewStatus");

-- CreateIndex
CREATE INDEX "AssessmentResponse_reviewedById_idx" ON "AssessmentResponse"("reviewedById");

-- AddForeignKey
ALTER TABLE "AssessmentPeriod" ADD CONSTRAINT "AssessmentPeriod_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResponse" ADD CONSTRAINT "AssessmentResponse_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
