-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'BPKP_ADMIN', 'BPKP_REVIEWER', 'BLUD_ADMIN', 'BLUD_OPERATOR', 'AUDITOR');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('DATABASE');

-- CreateTable
CREATE TABLE "Blud" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Blud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'BLUD_OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "bludId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentPeriod" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "bludId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewerNotes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentResponse" (
    "id" TEXT NOT NULL,
    "assessmentPeriodId" TEXT NOT NULL,
    "parameterId" INTEGER NOT NULL,
    "parameterLabel" TEXT NOT NULL,
    "criteriaCode" TEXT NOT NULL,
    "criteriaLabel" TEXT NOT NULL,
    "criteriaScore" DECIMAL(10,2) NOT NULL,
    "aoi" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentDocument" (
    "id" TEXT NOT NULL,
    "assessmentPeriodId" TEXT NOT NULL,
    "responseId" TEXT,
    "uploadedById" TEXT,
    "sourceParameter" TEXT,
    "name" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileExtension" TEXT,
    "fileSize" INTEGER NOT NULL,
    "storageProvider" "StorageProvider" NOT NULL DEFAULT 'DATABASE',
    "checksumSha256" TEXT,
    "fileData" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT,
    "previousState" JSONB,
    "nextState" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Blud_code_key" ON "Blud"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Blud_name_key" ON "Blud"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AssessmentPeriod_year_moduleKey_idx" ON "AssessmentPeriod"("year", "moduleKey");

-- CreateIndex
CREATE INDEX "AssessmentPeriod_status_year_idx" ON "AssessmentPeriod"("status", "year");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentPeriod_bludId_year_moduleKey_key" ON "AssessmentPeriod"("bludId", "year", "moduleKey");

-- CreateIndex
CREATE INDEX "AssessmentResponse_assessmentPeriodId_idx" ON "AssessmentResponse"("assessmentPeriodId");

-- CreateIndex
CREATE INDEX "AssessmentResponse_parameterId_idx" ON "AssessmentResponse"("parameterId");

-- CreateIndex
CREATE INDEX "AssessmentDocument_assessmentPeriodId_idx" ON "AssessmentDocument"("assessmentPeriodId");

-- CreateIndex
CREATE INDEX "AssessmentDocument_responseId_idx" ON "AssessmentDocument"("responseId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_bludId_fkey" FOREIGN KEY ("bludId") REFERENCES "Blud"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentPeriod" ADD CONSTRAINT "AssessmentPeriod_bludId_fkey" FOREIGN KEY ("bludId") REFERENCES "Blud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentPeriod" ADD CONSTRAINT "AssessmentPeriod_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResponse" ADD CONSTRAINT "AssessmentResponse_assessmentPeriodId_fkey" FOREIGN KEY ("assessmentPeriodId") REFERENCES "AssessmentPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentDocument" ADD CONSTRAINT "AssessmentDocument_assessmentPeriodId_fkey" FOREIGN KEY ("assessmentPeriodId") REFERENCES "AssessmentPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentDocument" ADD CONSTRAINT "AssessmentDocument_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "AssessmentResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentDocument" ADD CONSTRAINT "AssessmentDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
