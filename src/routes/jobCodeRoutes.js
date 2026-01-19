/**
 * JOB CODE ROUTES
 * ---------------
 * Defines all job code management endpoints
 */

const express = require('express');
const router = express.Router();
const jobCodeController = require('../controllers/jobCodeController');
const { requireAuth, requireAdminOrManager } = require('../middleware/authMiddleware');

// GET: Retrieve active job codes for a specific department
router.get('/job-codes/:department', requireAuth, jobCodeController.getJobCodesByDepartment);

// POST: Create a new Job Code
router.post('/save-job-code', requireAdminOrManager, jobCodeController.createJobCode);

// POST: Soft delete a Job Code (Mark as inactive)
router.post('/delete-job-code-def', requireAdminOrManager, jobCodeController.deleteJobCode);

module.exports = router;