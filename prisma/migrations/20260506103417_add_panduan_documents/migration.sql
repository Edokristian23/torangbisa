-- CreateTable
CREATE TABLE "GuideDocument" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileExtension" TEXT,
    "fileSize" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "fileData" BYTEA NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuideDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuideDocument_isActive_createdAt_idx" ON "GuideDocument"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "GuideDocument_uploadedById_idx" ON "GuideDocument"("uploadedById");

-- AddForeignKey
ALTER TABLE "GuideDocument" ADD CONSTRAINT "GuideDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
