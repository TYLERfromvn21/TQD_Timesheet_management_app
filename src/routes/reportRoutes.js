/**
 * REPORT ROUTES
 * ------------
 * Defines all Excel report generation endpoints
 */

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { requireAdminOrManager } = require('../middleware/authMiddleware');

// GET: Generate User Timesheet Report
router.get('/export/user-report', requireAdminOrManager, reportController.generateUserReportHandler);

// GET: Generate Job Summary Report
router.get('/export/job-report', requireAdminOrManager, reportController.generateJobReportHandler);

module.exports = router;