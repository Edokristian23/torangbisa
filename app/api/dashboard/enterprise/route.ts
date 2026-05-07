import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

type ParameterMeta = {
  id: number;
  label: string;
  maxScore: number;
  aspect: "Aspek 1" | "Aspek 2" | "Aspek 3";
  subAspect: string;
};

type FollowUpInfographicRow = {
  bludId: string;
  bludCode: string;
  bludName: string;
  lowScoreParameterCount: number;
  aoiCount: number;
  followUpCount: number;
  followUpEntryCount: number;
};

type ParameterInputRow = {
  parameterId: number;
  parameterLabel: string | null;
  criteriaScore: unknown;
};

const BLUD_ROLES = new Set(["BLUD_ADMIN", "BLUD_OPERATOR"]);
const BPKP_VIEWER_ROLES = new Set([
  "BPKP",
  "BPKP_ADMIN",
  "BPKP_REVIEWER",
  "SUPER_ADMIN",
  "AUDITOR",
  "REVIEWER",
]);
const BPKP_SELF_ASSESSMENT_ROLES = ["BPKP", "BPKP_ADMIN", "BPKP_REVIEWER"];

const parameterDefinitions: ParameterMeta[] = Array.from(
  { length: 28 },
  (_, idx) => {
    const id = idx + 1;

    let maxScore = 0;
    if ([1, 2].includes(id)) maxScore = 0.6;
    else if ([3, 4].includes(id)) maxScore = 0.4;
    else if (id >= 5 && id <= 12) maxScore = 0.03125;
    else if (id === 13) maxScore = 0.25;
    else if (id >= 14 && id <= 16) maxScore = 0.125;
    else if (id >= 17 && id <= 26) maxScore = 0.0625;
    else if (id === 27) maxScore = 1.25;
    else if (id === 28) maxScore = 0.25;

    let aspect: ParameterMeta["aspect"] = "Aspek 1";
    let subAspect = "1.1";

    if (id >= 1 && id <= 4) {
      aspect = "Aspek 1";
      subAspect = "1.1";
    } else if (id >= 5 && id <= 12) {
      aspect = "Aspek 2";
      subAspect = "2.1";
    } else if (id === 13) {
      aspect = "Aspek 2";
      subAspect = "2.2";
    } else if (id >= 14 && id <= 15) {
      aspect = "Aspek 2";
      subAspect = "2.3";
    } else if (id === 16) {
      aspect = "Aspek 2";
      subAspect = "2.4";
    } else if (id >= 17 && id <= 26) {
      aspect = "Aspek 2";
      subAspect = "2.5";
    } else {
      aspect = "Aspek 3";
      subAspect = "3.1";
    }

    return {
      id,
      label: `Parameter ${id}`,
      maxScore,
      aspect,
      subAspect,
    };
  },
);

const TOTAL_MAX_SCORE = parameterDefinitions.reduce(
  (sum, item) => sum + item.maxScore,
  0,
);

function normalizeParameterRows(rows: ParameterInputRow[]) {
  return rows.map((row) => ({
    parameterId: Number(row.parameterId),
    parameterLabel: row.parameterLabel ?? null,
    criteriaScore: Number(row.criteriaScore ?? 0),
  }));
}

function buildParameterResults(
  rows: Array<{
    parameterId: number;
    parameterLabel: string | null;
    criteriaScore: number;
  }>,
) {
  const grouped = new Map<
    number,
    { total: number; count: number; label?: string }
  >();

  for (const row of rows) {
    const current = grouped.get(row.parameterId) || {
      total: 0,
      count: 0,
      label: row.parameterLabel || undefined,
    };

    current.total += Number(row.criteriaScore || 0);
    current.count += 1;

    if (!current.label && row.parameterLabel) {
      current.label = row.parameterLabel;
    }

    grouped.set(row.parameterId, current);
  }

  return parameterDefinitions.map((item) => {
    const data = grouped.get(item.id);
    const rawScore = data?.count ? data.total / data.count : 0;
    const weightedScore = (rawScore / 5) * item.maxScore;

    return {
      id: item.id,
      label: data?.label || item.label,
      rawScore,
      weightedScore,
      maxScore: item.maxScore,
      aspect: item.aspect,
      subAspect: item.subAspect,
      responseCount: data?.count || 0,
    };
  });
}

function buildAspectResults(
  parameters: Array<{
    aspect: string;
    subAspect: string;
    weightedScore: number;
    maxScore: number;
  }>,
) {
  const aspectMap = new Map<string, typeof parameters>();

  for (const item of parameters) {
    const list = aspectMap.get(item.aspect) || [];
    list.push(item);
    aspectMap.set(item.aspect, list);
  }

  return Array.from(aspectMap.entries()).map(([aspect, items]) => {
    const totalWeighted = items.reduce(
      (sum, item) => sum + item.weightedScore,
      0,
    );
    const totalMax = items.reduce((sum, item) => sum + item.maxScore, 0);

    return {
      aspect,
      totalWeighted,
      totalMax,
      achievement: totalMax > 0 ? (totalWeighted / totalMax) * 100 : 0,
      parameterCount: items.length,
    };
  });
}

function bludInputWhere() {
  return {
    OR: [
      { createdByRole: null },
      { createdByRole: "BLUD_OPERATOR" },
      { createdByRole: "BLUD_ADMIN" },
    ],
  };
}

function bpkpSelfAssessmentWhere() {
  return {
    createdByRole: { in: BPKP_SELF_ASSESSMENT_ROLES },
  };
}

function isBpkpAdminDashboard(role: string) {
  return role === "BPKP_ADMIN" || role === "BPKP" || role === "BPKP_REVIEWER";
}

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const role = String(session.user.role).toUpperCase();
    const isBludViewer = BLUD_ROLES.has(role);
    const isBpkpViewer = BPKP_VIEWER_ROLES.has(role);
    const useBpkpSelfAssessmentRows = isBpkpAdminDashboard(role);

    if (!isBludViewer && !isBpkpViewer) {
      return NextResponse.json(
        { message: "Role tidak diizinkan mengakses dashboard." },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const year = Number(searchParams.get("year") || new Date().getFullYear());
    const moduleKey = searchParams.get("moduleKey")?.trim() || "";

    const selectedBludIds = (searchParams.get("bludIds") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const activeBluds = await prisma.blud.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });

    const totalBluds = await prisma.blud.count({
      where: { isActive: true },
    });

    let scopedBludIds: string[] = [];
    let currentBludName: string | null = null;

    if (isBludViewer) {
      if (!session.user.bludId) {
        return NextResponse.json(
          { message: "BLUD user tidak ditemukan." },
          { status: 400 },
        );
      }

      scopedBludIds = [String(session.user.bludId)];

      const currentBlud = await prisma.blud.findUnique({
        where: { id: String(session.user.bludId) },
        select: { name: true },
      });

      currentBludName = currentBlud?.name || null;
    } else if (selectedBludIds.length > 0) {
      scopedBludIds = selectedBludIds;
    }

    const scopedPeriodWhere: any = {
      year,
      ...(moduleKey ? { moduleKey } : {}),
      ...(scopedBludIds.length > 0
        ? {
            bludId:
              scopedBludIds.length === 1
                ? scopedBludIds[0]
                : { in: scopedBludIds },
          }
        : {}),
    };

    const baseResponseSourceWhere = useBpkpSelfAssessmentRows
      ? bpkpSelfAssessmentWhere()
      : bludInputWhere();

    const filledBludIdsFromResponse = await prisma.assessmentResponse.findMany({
      where: {
        assessmentPeriod: {
          year,
          ...(moduleKey ? { moduleKey } : {}),
        },
        ...baseResponseSourceWhere,
      },
      select: {
        assessmentPeriod: {
          select: {
            bludId: true,
          },
        },
      },
    });

    const filledBludIds = Array.from(
      new Set(filledBludIdsFromResponse.map((r) => r.assessmentPeriod.bludId)),
    );

    const scopedRows = await prisma.assessmentResponse.findMany({
      where: {
        assessmentPeriod: scopedPeriodWhere,
        ...baseResponseSourceWhere,
      },
      select: {
        id: true,
        parameterId: true,
        parameterLabel: true,
        criteriaLabel: true,
        criteriaScore: true,
        aoi: true,
        assessmentPeriod: {
          select: {
            id: true,
            moduleKey: true,
            year: true,
            bludId: true,
            reviewerNotes: true,
            blud: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const allRowsForFilledBluds = await prisma.assessmentResponse.findMany({
      where: {
        assessmentPeriod: {
          year,
          ...(moduleKey ? { moduleKey } : {}),
          ...(filledBludIds.length > 0
            ? { bludId: { in: filledBludIds } }
            : {}),
        },
        ...baseResponseSourceWhere,
      },
      select: {
        id: true,
        parameterId: true,
        parameterLabel: true,
        criteriaLabel: true,
        criteriaScore: true,
        aoi: true,
        assessmentPeriod: {
          select: {
            id: true,
            moduleKey: true,
            year: true,
            bludId: true,
            reviewerNotes: true,
            blud: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const normalizedScopedRows = normalizeParameterRows(scopedRows);
    const normalizedAllRowsForFilledBluds = normalizeParameterRows(
      allRowsForFilledBluds,
    );

    const parameters = buildParameterResults(normalizedScopedRows);
    const aspects = buildAspectResults(parameters);

    const bludParameterMap = new Map<
      string,
      {
        bludId: string;
        bludCode: string;
        bludName: string;
        parameterMap: Map<number, { total: number; count: number }>;
      }
    >();

    for (const row of allRowsForFilledBluds) {
      const bludId = row.assessmentPeriod.bludId;
      const bludCode = row.assessmentPeriod.blud.code;
      const bludName = row.assessmentPeriod.blud.name;

      const currentBlud = bludParameterMap.get(bludId) || {
        bludId,
        bludCode,
        bludName,
        parameterMap: new Map<number, { total: number; count: number }>(),
      };

      const currentParam = currentBlud.parameterMap.get(row.parameterId) || {
        total: 0,
        count: 0,
      };

      currentParam.total += Number(row.criteriaScore ?? 0);
      currentParam.count += 1;

      currentBlud.parameterMap.set(row.parameterId, currentParam);
      bludParameterMap.set(bludId, currentBlud);
    }

    const bludScores = Array.from(bludParameterMap.values())
      .map((blud) => {
        let totalScore = 0;

        const aspectScoreMap = new Map<
          ParameterMeta["aspect"],
          {
            aspect: ParameterMeta["aspect"];
            totalScore: number;
            totalMax: number;
            achievement: number;
          }
        >();

        for (const def of parameterDefinitions) {
          const paramData = blud.parameterMap.get(def.id);
          const rawScore = paramData?.count
            ? paramData.total / paramData.count
            : 0;

          const weightedScore = (rawScore / 5) * def.maxScore;
          totalScore += weightedScore;

          const current = aspectScoreMap.get(def.aspect) || {
            aspect: def.aspect,
            totalScore: 0,
            totalMax: 0,
            achievement: 0,
          };

          current.totalScore += weightedScore;
          current.totalMax += def.maxScore;
          current.achievement =
            current.totalMax > 0
              ? (current.totalScore / current.totalMax) * 100
              : 0;

          aspectScoreMap.set(def.aspect, current);
        }

        const aspectScores = Array.from(aspectScoreMap.values());

        return {
          bludId: blud.bludId,
          bludCode: blud.bludCode,
          bludName: blud.bludName,
          totalScore,
          achievement:
            TOTAL_MAX_SCORE > 0 ? (totalScore / TOTAL_MAX_SCORE) * 100 : 0,
          aspectScores,
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore);

    const scopedScoredParameters = parameters.filter(
      (item) => item.responseCount > 0,
    ).length;

    const scopedAverageRawScore =
      scopedScoredParameters > 0
        ? parameters
            .filter((item) => item.responseCount > 0)
            .reduce((sum, item) => sum + item.rawScore, 0) /
          scopedScoredParameters
        : 0;

    const scopedTotalWeightedScore = parameters.reduce(
      (sum, item) => sum + item.weightedScore,
      0,
    );

    const infographicSourceRows = isBludViewer
      ? scopedRows
      : useBpkpSelfAssessmentRows && selectedBludIds.length > 0
        ? scopedRows
        : allRowsForFilledBluds;

    const infographicResponseIds = infographicSourceRows.map((row) => row.id);

    const followUpEntries =
      infographicResponseIds.length > 0
        ? await prisma.followUpEntry.findMany({
            where: {
              assessmentResponseId: {
                in: infographicResponseIds,
              },
            },
            select: {
              id: true,
              assessmentResponseId: true,
            },
          })
        : [];

    const followUpEntryCountByResponseId = new Map<string, number>();
    for (const item of followUpEntries) {
      followUpEntryCountByResponseId.set(
        item.assessmentResponseId,
        (followUpEntryCountByResponseId.get(item.assessmentResponseId) || 0) +
          1,
      );
    }

    const infographicMap = new Map<string, FollowUpInfographicRow>();

    for (const row of infographicSourceRows) {
      const bludId = row.assessmentPeriod.bludId;

      const current = infographicMap.get(bludId) || {
        bludId,
        bludCode: row.assessmentPeriod.blud.code,
        bludName: row.assessmentPeriod.blud.name,
        lowScoreParameterCount: 0,
        aoiCount: 0,
        followUpCount: 0,
        followUpEntryCount: 0,
      };

      if (Number(row.criteriaScore ?? 0) < 3) {
        current.lowScoreParameterCount += 1;
      }

      const hasAoi = Boolean(row.aoi && row.aoi.trim().length > 0);
      const entryCount = followUpEntryCountByResponseId.get(row.id) || 0;

      if (hasAoi) {
        current.aoiCount += 1;

        if (entryCount > 0) {
          current.followUpCount += 1;
        }

        current.followUpEntryCount += entryCount;
      }

      infographicMap.set(bludId, current);
    }

    let infographicRows = Array.from(infographicMap.values()).sort((a, b) =>
      a.bludName.localeCompare(b.bludName),
    );

    if (!isBludViewer && selectedBludIds.length > 0) {
      infographicRows = infographicRows.filter((item) =>
        selectedBludIds.includes(item.bludId),
      );
    }

    const infographicSummary = infographicRows.reduce(
      (acc, item) => {
        acc.totalLowScoreParameters += item.lowScoreParameterCount;
        acc.totalAoi += item.aoiCount;
        acc.totalFollowUps += item.followUpCount;
        acc.totalFollowUpEntries += item.followUpEntryCount;
        return acc;
      },
      {
        totalLowScoreParameters: 0,
        totalAoi: 0,
        totalFollowUps: 0,
        totalFollowUpEntries: 0,
      },
    );

    let summary;

    if (isBludViewer || (useBpkpSelfAssessmentRows && selectedBludIds.length > 0)) {
      summary = {
        totalResponses: filledBludIds.length,
        totalBluds,
        scoredParameters: scopedScoredParameters,
        totalWeightedScore: scopedTotalWeightedScore,
        totalMaxScore: TOTAL_MAX_SCORE,
        achievement:
          TOTAL_MAX_SCORE > 0
            ? (scopedTotalWeightedScore / TOTAL_MAX_SCORE) * 100
            : 0,
        averageRawScore: scopedAverageRawScore,
      };
    } else {
      const totalFilledBluds = bludScores.length;
      const averageTotalScore =
        totalFilledBluds > 0
          ? bludScores.reduce((sum, item) => sum + item.totalScore, 0) /
            totalFilledBluds
          : 0;

      const averageAchievement =
        totalFilledBluds > 0
          ? bludScores.reduce((sum, item) => sum + item.achievement, 0) /
            totalFilledBluds
          : 0;

      const globalParameterResults = buildParameterResults(
        normalizedAllRowsForFilledBluds,
      );
      const globalScoredParameters = globalParameterResults.filter(
        (item) => item.responseCount > 0,
      ).length;

      const globalAverageRawScore =
        globalScoredParameters > 0
          ? globalParameterResults
              .filter((item) => item.responseCount > 0)
              .reduce((sum, item) => sum + item.rawScore, 0) /
            globalScoredParameters
          : 0;

      summary = {
        totalResponses: filledBludIds.length,
        totalBluds,
        scoredParameters: globalScoredParameters,
        totalWeightedScore: averageTotalScore,
        totalMaxScore: TOTAL_MAX_SCORE,
        achievement: averageAchievement,
        averageRawScore: globalAverageRawScore,
      };
    }

    return NextResponse.json({
      summary,
      parameters,
      aspects,
      // Untuk Admin BPKP, grafik Perbandingan Skor Total Antar BLUD harus tetap global
      // pada tahun yang sama, walaupun filter BLUD dipilih. Filter BLUD hanya
      // memengaruhi kartu ringkasan seperti Parameter Terisi, Nilai Total, dan
      // Nilai Capaian melalui objek summary di atas.
      bludScores,
      infographics: {
        summary: infographicSummary,
        rows: infographicRows,
      },
      filters: {
        bluds: activeBluds,
        selectedBludIds: isBludViewer ? [] : selectedBludIds,
      },
      viewer: {
        role,
        isBludScoped: isBludViewer,
        currentBludId: isBludViewer ? String(session.user.bludId || "") : null,
        currentBludName,
        canReviewAoi: role === "BLUD_ADMIN",
        dataSource: useBpkpSelfAssessmentRows ? "BPKP_SELF_ASSESSMENT" : "BLUD_SELF_ASSESSMENT",
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/enterprise error:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Gagal mengambil data dashboard",
      },
      { status: 500 },
    );
  }
}
