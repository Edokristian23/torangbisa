-- AlterTable
ALTER TABLE "AssessmentDocument" ADD COLUMN     "isMaster" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "AssessmentDocument_isMaster_idx" ON "AssessmentDocument"("isMaster");
