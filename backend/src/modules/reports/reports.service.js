const AppError = require("../../common/AppError");
const prisma = require("../../config/prisma");

const STATUS_INPUT_TO_ENUM = Object.freeze({
  open: "OPEN",
  resolved: "RESOLVED"
});

const STATUS_ENUM_TO_OUTPUT = Object.freeze({
  OPEN: "open",
  RESOLVED: "resolved"
});

const REPORT_INCLUDE = Object.freeze({
  story: {
    select: {
      id: true,
      title: true,
      authorId: true
    }
  },
  reportedByUser: {
    select: {
      id: true,
      email: true,
      displayName: true,
      username: true
    }
  }
});

function toIsoString(value) {
  return value instanceof Date ? value.toISOString() : String(value || "");
}

function normalizeReportStatus(rawStatus) {
  const key = String(rawStatus || "").trim().toLowerCase();
  if (!key) {
    return undefined;
  }

  const status = STATUS_INPUT_TO_ENUM[key];
  if (!status) {
    throw new AppError(400, "Invalid report status. Use open/resolved.");
  }

  return status;
}

function toPublicReport(report) {
  return {
    id: report.id,
    storyId: report.storyId,
    storyTitle: report.story?.title || "",
    reportedBy: report.reportedByUser ? {
      id: report.reportedByUser.id,
      email: report.reportedByUser.email,
      displayName: report.reportedByUser.displayName || null,
      username: report.reportedByUser.username || null
    } : null,
    reason: report.reason,
    details: report.details || "",
    status: STATUS_ENUM_TO_OUTPUT[report.status] || "open",
    createdAt: toIsoString(report.createdAt),
    updatedAt: toIsoString(report.updatedAt)
  };
}

async function listReports(query = {}) {
  const where = {};
  const status = normalizeReportStatus(query.status);
  const storyId = String(query.storyId || "").trim();

  if (status) {
    where.status = status;
  }

  if (storyId) {
    where.storyId = storyId;
  }

  const reports = await prisma.report.findMany({
    where,
    include: REPORT_INCLUDE,
    orderBy: {
      createdAt: "desc"
    }
  });

  return reports.map(toPublicReport);
}

async function createReport(payload, actor) {
  const storyId = String(payload.storyId || "").trim();
  const reason = String(payload.reason || "").trim();
  const details = String(payload.details || "").trim();
  const reportedByUserId = String(actor?.userId || "").trim();

  if (!reportedByUserId) {
    throw new AppError(401, "Unauthorized.");
  }

  if (!storyId) {
    throw new AppError(400, "storyId is required.");
  }

  if (!reason) {
    throw new AppError(400, "reason is required.");
  }

  const story = await prisma.story.findUnique({
    where: {
      id: storyId
    },
    select: {
      id: true,
      title: true,
      authorId: true
    }
  });

  if (!story) {
    throw new AppError(404, "Story not found.");
  }

  if (story.authorId === reportedByUserId) {
    throw new AppError(400, "You cannot report your own story.");
  }

  const existingOpenReport = await prisma.report.findFirst({
    where: {
      storyId,
      reportedByUserId,
      status: "OPEN"
    },
    select: {
      id: true
    }
  });

  if (existingOpenReport) {
    throw new AppError(409, "You already have an open report for this story.");
  }

  const report = await prisma.report.create({
    data: {
      storyId,
      reportedByUserId,
      reason,
      details
    },
    include: REPORT_INCLUDE
  });

  return toPublicReport(report);
}

async function updateReport(id, payload) {
  const existing = await prisma.report.findUnique({
    where: {
      id
    },
    include: REPORT_INCLUDE
  });

  if (!existing) {
    throw new AppError(404, "Report not found.");
  }

  const data = {};

  if (payload.status !== undefined) {
    data.status = normalizeReportStatus(payload.status);
  }

  if (payload.reason !== undefined) {
    const reason = String(payload.reason || "").trim();
    if (!reason) {
      throw new AppError(400, "reason cannot be empty.");
    }
    data.reason = reason;
  }

  if (payload.details !== undefined) {
    data.details = String(payload.details || "").trim();
  }

  if (!Object.keys(data).length) {
    return toPublicReport(existing);
  }

  const updated = await prisma.report.update({
    where: {
      id
    },
    data,
    include: REPORT_INCLUDE
  });

  return toPublicReport(updated);
}

async function deleteReport(id) {
  const existing = await prisma.report.findUnique({
    where: {
      id
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    throw new AppError(404, "Report not found.");
  }

  const deleted = await prisma.report.delete({
    where: {
      id
    },
    include: REPORT_INCLUDE
  });

  return toPublicReport(deleted);
}

module.exports = {
  listReports,
  createReport,
  updateReport,
  deleteReport
};
