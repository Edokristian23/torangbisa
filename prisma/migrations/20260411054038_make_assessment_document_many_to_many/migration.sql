/*
  Warnings:

  - You are about to drop the column `responseId` on the `AssessmentDocument` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "AssessmentDocument" DROP CONSTRAINT "AssessmentDocument_responseId_fkey";

-- DropIndex
DROP INDEX "AssessmentDocument_responseId_idx";

-- AlterTable
ALTER TABLE "AssessmentDocument" DROP COLUMN "responseId";

-- CreateTable
CREATE TABLE "AssessmentResponseDocument" (
    "responseId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentResponseDocument_pkey" PRIMARY KEY ("responseId","documentId")
);

-- CreateIndex
CREATE INDEX "AssessmentResponseDocument_documentId_idx" ON "AssessmentResponseDocument"("documentId");

-- CreateIndex
CREATE INDEX "AssessmentResponseDocument_responseId_idx" ON "AssessmentResponseDocument"("responseId");

-- AddForeignKey
ALTER TABLE "AssessmentResponseDocument" ADD CONSTRAINT "AssessmentResponseDocument_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AssessmentResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResponseDocument" ADD CONSTRAINT "AssessmentResponseDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AssessmentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
