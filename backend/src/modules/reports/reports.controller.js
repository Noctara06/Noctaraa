const service = require("./reports.service");

async function listReports(req, res, next) {
  try {
    const reports = await service.listReports(req.query || {});
    res.status(200).json({
      success: true,
      data: reports
    });
  } catch (error) {
    next(error);
  }
}

async function createReport(req, res, next) {
  try {
    const report = await service.createReport(req.body || {}, req.auth || {});
    res.status(201).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
}

async function updateReport(req, res, next) {
  try {
    const report = await service.updateReport(req.params.id, req.body || {});
    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    next(error);
  }
}

async function deleteReport(req, res, next) {
  try {
    const deleted = await service.deleteReport(req.params.id);
    res.status(200).json({
      success: true,
      data: deleted
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listReports,
  createReport,
  updateReport,
  deleteReport
};
