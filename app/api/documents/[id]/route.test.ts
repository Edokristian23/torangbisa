import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@prisma/client";
import { DELETE } from "./route";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    assessmentDocument: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog: vi.fn(),
}));

vi.mock("@/lib/assessment", () => ({
  canMutateAssessment: vi.fn(),
  mapStatusLabel: vi.fn(),
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { canMutateAssessment, mapStatusLabel } from "@/lib/assessment";

const mockedAuth = vi.mocked(auth);
const mockedPrisma = vi.mocked(prisma, true);
const mockedCreateAuditLog = vi.mocked(createAuditLog);
const mockedCanMutateAssessment = vi.mocked(canMutateAssessment);
const mockedMapStatusLabel = vi.mocked(mapStatusLabel);

function makeRequest(body?: Record<string, unknown>) {
  return new Request("http://localhost/api/documents/doc-1", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
}

function makeContext(id = "doc-1") {
  return {
    params: Promise.resolve({ id }),
  };
}

function makeSession() {
  return {
    user: {
      id: "user-1",
      role: UserRole.BLUD_OPERATOR,
      bludId: "blud-1",
    },
  };
}

function makeDocument() {
  return {
    id: "doc-1",
    assessmentPeriodId: "period-1",
    uploadedById: "user-1",
    sourceParameter: "parameter-1",
    name: "Doc Test",
    originalName: "doc-test.pdf",
    mimeType: "application/pdf",
    fileExtension: "pdf",
    fileSize: 12345,
    storageProvider: "DATABASE",
    checksumSha256: "abc123",
    fileData: new Uint8Array([1, 2, 3]),
    assessmentPeriod: {
      id: "period-1",
      bludId: "blud-1",
      status: "DRAFT",
    },
    responseLinks: [
      {
        responseId: "resp-1",
        documentId: "doc-1",
        createdAt: new Date("2026-04-22T02:09:25.825Z"),
      },
    ],
    followUpLinks: [],
  };
}

function createTxMock(overrides?: {
  deletedResponseCount?: number;
  deletedFollowUpCount?: number;
  remainingResponseLink?: {
    responseId: string;
    documentId: string;
    createdAt: Date;
  } | null;
  remainingFollowUpLink?: {
    followUpEntryId: string;
    documentId: string;
    createdAt: Date;
  } | null;
}) {
  return {
    assessmentResponseDocument: {
      deleteMany: vi.fn().mockResolvedValue({
        count: overrides?.deletedResponseCount ?? 0,
      }),
      findFirst: vi.fn().mockResolvedValue(
        overrides?.remainingResponseLink ?? null,
      ),
    },
    followUpEntryDocument: {
      deleteMany: vi.fn().mockResolvedValue({
        count: overrides?.deletedFollowUpCount ?? 0,
      }),
      findFirst: vi.fn().mockResolvedValue(
        overrides?.remainingFollowUpLink ?? null,
      ),
    },
    assessmentDocument: {
      delete: vi.fn().mockResolvedValue({ id: "doc-1" }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mockedAuth.mockResolvedValue(makeSession() as never);
  mockedCanMutateAssessment.mockReturnValue(true as never);
  mockedMapStatusLabel.mockReturnValue("Draft" as never);
  mockedCreateAuditLog.mockResolvedValue(undefined as never);

  mockedPrisma.assessmentDocument.findUnique.mockResolvedValue(
    makeDocument() as never,
  );
});

describe("DELETE /api/documents/[id]", () => {
  it("unlink 1 dari banyak relasi: master tidak dihapus", async () => {
    const tx = createTxMock({
      deletedResponseCount: 1,
      deletedFollowUpCount: 0,
      remainingResponseLink: {
        responseId: "resp-zombie",
        documentId: "doc-1",
        createdAt: new Date("2026-04-22T02:09:25.825Z"),
      },
      remainingFollowUpLink: null,
    });

    mockedPrisma.$transaction.mockImplementation(async (callback: any) => {
      return callback(tx);
    });

    const response = await DELETE(
      makeRequest({ responseId: "resp-1" }),
      makeContext(),
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.deletedMasterDocument).toBe(false);
    expect(json.removedResponseLinks).toBe(1);
    expect(json.removedFollowUpLinks).toBe(0);
    expect(json.remainingResponseLinks).toBe(1);
    expect(json.remainingFollowUpLinks).toBe(0);
    expect(json.remainingResponseLinkDetails).toEqual([
      {
        responseId: "resp-zombie",
        documentId: "doc-1",
        createdAt: new Date("2026-04-22T02:09:25.825Z"),
      },
    ]);

    expect(tx.assessmentResponseDocument.deleteMany).toHaveBeenCalledWith({
      where: {
        documentId: "doc-1",
        responseId: "resp-1",
      },
    });

    expect(tx.assessmentDocument.delete).not.toHaveBeenCalled();

    expect(mockedCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "UNLINK_DOCUMENT",
        entityId: "doc-1",
        metadata: expect.objectContaining({
          responseId: "resp-1",
          deletedMasterDocument: false,
          remainingResponseLinks: 1,
        }),
      }),
    );
  });

  it("unlink relasi terakhir: master ikut dihapus", async () => {
    const tx = createTxMock({
      deletedResponseCount: 1,
      deletedFollowUpCount: 0,
      remainingResponseLink: null,
      remainingFollowUpLink: null,
    });

    mockedPrisma.$transaction.mockImplementation(async (callback: any) => {
      return callback(tx);
    });

    const response = await DELETE(
      makeRequest({ responseId: "resp-1" }),
      makeContext(),
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.deletedMasterDocument).toBe(true);
    expect(json.removedResponseLinks).toBe(1);
    expect(json.removedFollowUpLinks).toBe(0);
    expect(json.remainingResponseLinks).toBe(0);
    expect(json.remainingFollowUpLinks).toBe(0);
    expect(json.remainingResponseLinkDetails).toEqual([]);
    expect(json.remainingFollowUpLinkDetails).toEqual([]);

    expect(tx.assessmentResponseDocument.deleteMany).toHaveBeenCalledWith({
      where: {
        documentId: "doc-1",
        responseId: "resp-1",
      },
    });

    expect(tx.assessmentDocument.delete).toHaveBeenCalledWith({
      where: { id: "doc-1" },
    });

    expect(mockedCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DELETE_DOCUMENT",
        entityId: "doc-1",
        metadata: expect.objectContaining({
          responseId: "resp-1",
          deletedMasterDocument: true,
          remainingResponseLinks: 0,
          remainingFollowUpLinks: 0,
        }),
      }),
    );
  });

  it("hapus tanpa responseId dan followUpEntryId: semua relasi dilepas lalu master dihapus", async () => {
    const tx = createTxMock({
      deletedResponseCount: 2,
      deletedFollowUpCount: 1,
      remainingResponseLink: null,
      remainingFollowUpLink: null,
    });

    mockedPrisma.$transaction.mockImplementation(async (callback: any) => {
      return callback(tx);
    });

    const response = await DELETE(makeRequest({}), makeContext());

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.deletedMasterDocument).toBe(true);
    expect(json.removedResponseLinks).toBe(2);
    expect(json.removedFollowUpLinks).toBe(1);
    expect(json.remainingResponseLinks).toBe(0);
    expect(json.remainingFollowUpLinks).toBe(0);

    expect(tx.assessmentResponseDocument.deleteMany).toHaveBeenCalledWith({
      where: {
        documentId: "doc-1",
      },
    });

    expect(tx.followUpEntryDocument.deleteMany).toHaveBeenCalledWith({
      where: {
        documentId: "doc-1",
      },
    });

    expect(tx.assessmentDocument.delete).toHaveBeenCalledWith({
      where: { id: "doc-1" },
    });

    expect(mockedCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "DELETE_DOCUMENT",
        entityId: "doc-1",
        metadata: expect.objectContaining({
          responseId: null,
          followUpEntryId: null,
          removedResponseLinks: 2,
          removedFollowUpLinks: 1,
          deletedMasterDocument: true,
        }),
      }),
    );
  });
});