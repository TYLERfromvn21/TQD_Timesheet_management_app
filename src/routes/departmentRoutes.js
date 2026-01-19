/**
 * DEPARTMENT ROUTES
 * ----------------
 * Defines all department-related endpoints
 */

const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { requireAdminOrManager } = require('../middleware/authMiddleware');

// GET: Retrieve all departments for dropdown lists
router.get('/api/departments', departmentController.getDepartments);

// POST: Add a new department (Admin Total only)
router.post('/api/add-department', requireAdminOrManager, departmentController.addDepartment);

// POST: Update department name
router.post('/api/update-department', requireAdminOrManager, departmentController.updateDepartment);

// POST: Delete department
router.post('/api/delete-department', requireAdminOrManager, departmentController.deleteDepartment);

module.exports = router;