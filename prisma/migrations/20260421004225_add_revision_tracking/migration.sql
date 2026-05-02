-- AlterTable
ALTER TABLE "AssessmentResponse" ADD COLUMN     "isRevision" BOOLEAN DEFAULT false,
ADD COLUMN     "previousAoi" TEXT,
ADD COLUMN     "previousCriteriaCode" TEXT,
ADD COLUMN     "previousCriteriaLabel" TEXT,
ADD COLUMN     "previousCriteriaScore" DECIMAL(10,2),
ADD COLUMN     "previousDocuments" JSONB,
ADD COLUMN     "revisionNumber" INTEGER;
