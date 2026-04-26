-- CreateTable
CREATE TABLE "FollowUpEntry" (
    "id" TEXT NOT NULL,
    "assessmentResponseId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpEntryDocument" (
    "followUpEntryId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpEntryDocument_pkey" PRIMARY KEY ("followUpEntryId","documentId")
);

-- CreateIndex
CREATE INDEX "FollowUpEntry_assessmentResponseId_idx" ON "FollowUpEntry"("assessmentResponseId");

-- CreateIndex
CREATE INDEX "FollowUpEntry_createdById_idx" ON "FollowUpEntry"("createdById");

-- CreateIndex
CREATE INDEX "FollowUpEntryDocument_documentId_idx" ON "FollowUpEntryDocument"("documentId");

-- CreateIndex
CREATE INDEX "FollowUpEntryDocument_followUpEntryId_idx" ON "FollowUpEntryDocument"("followUpEntryId");

-- AddForeignKey
ALTER TABLE "FollowUpEntry" ADD CONSTRAINT "FollowUpEntry_assessmentResponseId_fkey" FOREIGN KEY ("assessmentResponseId") REFERENCES "AssessmentResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpEntry" ADD CONSTRAINT "FollowUpEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpEntryDocument" ADD CONSTRAINT "FollowUpEntryDocument_followUpEntryId_fkey" FOREIGN KEY ("followUpEntryId") REFERENCES "FollowUpEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpEntryDocument" ADD CONSTRAINT "FollowUpEntryDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "AssessmentDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
