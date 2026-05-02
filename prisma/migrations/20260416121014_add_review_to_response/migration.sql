-- DropIndex
DROP INDEX "AssessmentResponse_assessmentPeriodId_idx";

-- DropIndex
DROP INDEX "AssessmentResponse_parameterId_idx";

-- AlterTable
ALTER TABLE "AssessmentResponse" ADD COLUMN     "reviewNotes" TEXT,
ADD COLUMN     "reviewStatus" TEXT DEFAULT 'pending',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT;
